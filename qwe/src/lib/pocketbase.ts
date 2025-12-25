import PocketBase, { type RecordModel, type AuthModel } from 'pocketbase';

// Create a PocketBase instance
// Uses PUBLIC_PB_URL env var or defaults to localhost
const PB_URL = import.meta.env.PUBLIC_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Disable auto-cancellation for tests (prevents request conflicts)
pb.autoCancellation(false);

// Export the PocketBase class and types for usage
export { PocketBase, type RecordModel, type AuthModel };

// Export the base URL for reference
export const pbUrl = PB_URL;

// ============================================
// Health & Connection
// ============================================

export async function checkHealth(): Promise<{ healthy: boolean; message: string; code: number }> {
	try {
		const health = await pb.health.check();
		return { healthy: true, message: health.message, code: health.code };
	} catch (error) {
		return { healthy: false, message: String(error), code: 0 };
	}
}

// ============================================
// Authentication Helpers
// ============================================

export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

export function getCurrentUser(): AuthModel {
	return pb.authStore.record;
}

export function logout(): void {
	pb.authStore.clear();
}

export async function registerUser(
	email: string,
	password: string,
	passwordConfirm: string,
	name?: string
): Promise<RecordModel> {
	const data = {
		email,
		password,
		passwordConfirm,
		name: name || email.split('@')[0]
	};
	return await pb.collection('users').create(data);
}

export async function loginWithEmail(
	email: string,
	password: string
): Promise<{ token: string; record: RecordModel }> {
	const authData = await pb.collection('users').authWithPassword(email, password);
	return { token: authData.token, record: authData.record };
}

export async function loginWithGoogle(): Promise<{ token: string; record: RecordModel }> {
	const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
	return { token: authData.token, record: authData.record };
}

export async function requestPasswordReset(email: string): Promise<boolean> {
	await pb.collection('users').requestPasswordReset(email);
	return true;
}

export async function requestEmailVerification(email: string): Promise<boolean> {
	await pb.collection('users').requestVerification(email);
	return true;
}

// ============================================
// Generic CRUD Operations
// ============================================

export async function createRecord<T extends Record<string, unknown>>(
	collection: string,
	data: T
): Promise<RecordModel> {
	return await pb.collection(collection).create(data);
}

export async function getRecord(collection: string, id: string): Promise<RecordModel> {
	return await pb.collection(collection).getOne(id);
}

export async function updateRecord<T extends Record<string, unknown>>(
	collection: string,
	id: string,
	data: T
): Promise<RecordModel> {
	return await pb.collection(collection).update(id, data);
}

export async function deleteRecord(collection: string, id: string): Promise<boolean> {
	return await pb.collection(collection).delete(id);
}

export async function listRecords(
	collection: string,
	page = 1,
	perPage = 20,
	filter = '',
	sort = ''
): Promise<{ items: RecordModel[]; totalItems: number; totalPages: number }> {
	const options: { filter?: string; sort?: string } = {};
	if (filter) options.filter = filter;
	if (sort) options.sort = sort;
	const result = await pb.collection(collection).getList(page, perPage, options);
	return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages };
}

// ============================================
// Realtime Subscriptions
// ============================================

export function subscribeToCollection(
	collection: string,
	callback: (data: { action: string; record: RecordModel }) => void
): () => void {
	pb.collection(collection).subscribe('*', callback);
	return () => pb.collection(collection).unsubscribe('*');
}

export function subscribeToRecord(
	collection: string,
	recordId: string,
	callback: (data: { action: string; record: RecordModel }) => void
): () => void {
	pb.collection(collection).subscribe(recordId, callback);
	return () => pb.collection(collection).unsubscribe(recordId);
}

// ============================================
// File Operations
// ============================================

export function getFileUrl(
	record: RecordModel,
	filename: string,
	queryParams: Record<string, string> = {}
): string {
	return pb.files.getURL(record, filename, queryParams);
}

export async function uploadFile(
	collection: string,
	recordId: string,
	fieldName: string,
	file: File
): Promise<RecordModel> {
	const formData = new FormData();
	formData.append(fieldName, file);
	return await pb.collection(collection).update(recordId, formData);
}

// ============================================
// Collection Schema Check (for testing)
// ============================================

export type CollectionCheckResult = {
	exists: boolean;
	accessible: boolean;
	error?: string;
};

export async function checkCollection(collectionName: string): Promise<CollectionCheckResult> {
	try {
		// Try to list with limit 1 to check if collection exists and is accessible
		await pb.collection(collectionName).getList(1, 1);
		return { exists: true, accessible: true };
	} catch (error: unknown) {
		// Check if it's a PocketBase ClientResponseError
		if (error && typeof error === 'object' && 'status' in error) {
			const status = (error as { status: number }).status;
			const message = (error as { message?: string }).message || '';

			// 404 = Collection doesn't exist
			if (status === 404) {
				return {
					exists: false,
					accessible: false,
					error: `Collection "${collectionName}" not found. Create it in PocketBase Admin.`
				};
			}

			// 403 = Collection exists but API rules block access
			if (status === 403) {
				return {
					exists: true,
					accessible: false,
					error: `Collection "${collectionName}" exists but API rules block access. Set List/View rules in PocketBase Admin.`
				};
			}

			// Other errors
			return {
				exists: false,
				accessible: false,
				error: `Error checking collection: ${message}`
			};
		}

		return {
			exists: false,
			accessible: false,
			error: String(error)
		};
	}
}

// Legacy function for backwards compatibility
export async function collectionExists(collectionName: string): Promise<boolean> {
	const result = await checkCollection(collectionName);
	return result.exists && result.accessible;
}
