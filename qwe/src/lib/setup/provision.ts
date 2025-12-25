// Core provisioning logic for auto-creating PocketBase collections
// This module can be used from CLI scripts or browser contexts

import PocketBase from 'pocketbase';
import { type CollectionSchema, DEFAULT_COLLECTIONS } from './schemas.js';

// ============================================
// Types
// ============================================

export interface ProvisionResult {
	success: boolean;
	created: string[];
	skipped: string[];
	errors: Array<{ collection: string; error: string }>;
	message: string;
}

export interface ProvisionOptions {
	/** PocketBase server URL */
	pbUrl: string;
	/** Admin email for authentication */
	adminEmail: string;
	/** Admin password for authentication */
	adminPassword: string;
	/** Collections to provision (defaults to DEFAULT_COLLECTIONS) */
	collections?: CollectionSchema[];
	/** If true, will update existing collections instead of skipping */
	updateExisting?: boolean;
	/** Callback for progress updates */
	onProgress?: (message: string) => void;
	/** Optional settings to update (e.g., auth providers) */
	settings?: Record<string, any>;
}

// ============================================
// Provisioning Functions
// ============================================

/**
 * Provision collections in PocketBase
 * This function is idempotent - safe to run multiple times
 */
export async function provisionCollections(options: ProvisionOptions): Promise<ProvisionResult> {
	const {
		pbUrl,
		adminEmail,
		adminPassword,
		collections = DEFAULT_COLLECTIONS,
		updateExisting = false,
		onProgress = () => { },
		settings
	} = options;

	const result: ProvisionResult = {
		success: true,
		created: [],
		skipped: [],
		errors: [],
		message: ''
	};

	const pb = new PocketBase(pbUrl);
	pb.autoCancellation(false);

	// Step 1: Authenticate as admin
	onProgress('Authenticating as admin...');
	try {
		await pb.admins.authWithPassword(adminEmail, adminPassword);
		onProgress('✓ Admin authentication successful');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		result.success = false;
		result.message = `Admin authentication failed: ${errorMsg}`;
		result.errors.push({ collection: '_admin', error: errorMsg });
		return result;
	}

	// Step 2: Get existing collections
	onProgress('Fetching existing collections...');
	let existingCollections: Set<string>;
	try {
		const allCollections = await pb.collections.getFullList();
		existingCollections = new Set(allCollections.map(c => c.name));
		onProgress(`✓ Found ${existingCollections.size} existing collections`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		result.success = false;
		result.message = `Failed to fetch collections: ${errorMsg}`;
		result.errors.push({ collection: '_system', error: errorMsg });
		return result;
	}

	// Step 2.5: Update settings or auth providers if provided
	if (settings) {
		if (settings.googleAuth) {
			onProgress('Updating collection OAuth2 settings...');
			try {
				const users = await pb.collections.getOne('users');
				const oauth2 = {
					enabled: true,
					providers: [
						{
							name: 'google',
							clientId: settings.googleAuth.clientId,
							clientSecret: settings.googleAuth.clientSecret
						}
					]
				};
				await pb.collections.update(users.id, { oauth2 });
				onProgress('✓ Google OAuth2 enabled on "users" collection');
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.errors.push({ collection: 'users', error: errorMsg });
				onProgress(`✗ Failed to update OAuth2 settings: ${errorMsg}`);
			}
		} else {
			// Fallback: original settings update for older PB versions or other settings
			onProgress('Updating global PocketBase settings...');
			try {
				await pb.settings.update(settings);
				onProgress('✓ Settings updated successfully');
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.errors.push({ collection: '_settings', error: errorMsg });
				onProgress(`✗ Failed to update settings: ${errorMsg}`);
			}
		}
	}

	// Step 3: Provision each collection
	for (const schema of collections) {
		onProgress(`Processing "${schema.name}"...`);

		if (existingCollections.has(schema.name)) {
			if (updateExisting) {
				// Update existing collection
				try {
					const existing = await pb.collections.getOne(schema.name);
					await pb.collections.update(existing.id, buildCollectionPayload(schema));
					result.created.push(`${schema.name} (updated)`);
					onProgress(`✓ Updated "${schema.name}"`);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					result.errors.push({ collection: schema.name, error: errorMsg });
					onProgress(`✗ Failed to update "${schema.name}": ${errorMsg}`);
				}
			} else {
				result.skipped.push(schema.name);
				onProgress(`○ Skipped "${schema.name}" (already exists)`);
			}
			continue;
		}

		// Create new collection
		try {
			await pb.collections.create(buildCollectionPayload(schema));
			result.created.push(schema.name);
			onProgress(`✓ Created "${schema.name}"`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			result.errors.push({ collection: schema.name, error: errorMsg });
			onProgress(`✗ Failed to create "${schema.name}": ${errorMsg}`);
		}
	}

	// Build final result
	if (result.errors.length > 0) {
		result.success = false;
		result.message = `Completed with ${result.errors.length} error(s)`;
	} else if (result.created.length === 0 && result.skipped.length > 0) {
		result.message = `All ${result.skipped.length} collection(s) already exist`;
	} else {
		result.message = `Successfully created ${result.created.length} collection(s)`;
	}

	// Clear admin auth
	pb.authStore.clear();

	return result;
}

/**
 * Check if PocketBase server is reachable
 */
export async function checkPocketBaseHealth(pbUrl: string): Promise<{ healthy: boolean; message: string }> {
	const pb = new PocketBase(pbUrl);
	try {
		const health = await pb.health.check();
		return { healthy: true, message: health.message };
	} catch (error) {
		return { healthy: false, message: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Check if admin credentials are valid
 */
export async function validateAdminCredentials(
	pbUrl: string,
	email: string,
	password: string
): Promise<{ valid: boolean; message: string }> {
	const pb = new PocketBase(pbUrl);
	try {
		await pb.admins.authWithPassword(email, password);
		pb.authStore.clear();
		return { valid: true, message: 'Credentials valid' };
	} catch (error) {
		return { valid: false, message: error instanceof Error ? error.message : String(error) };
	}
}

// ============================================
// Helpers
// ============================================

/**
 * Build the payload for PocketBase collection create/update API
 * Compatible with PocketBase v0.23+ which uses 'fields' instead of 'schema'
 */
function buildCollectionPayload(schema: CollectionSchema): Record<string, unknown> {
	// Build fields array with proper structure for PocketBase v0.23+
	const fields = schema.fields.map(field => {
		const baseField: Record<string, unknown> = {
			name: field.name,
			type: field.type,
			required: field.required ?? false
		};

		// Add type-specific options
		if (field.type === 'text') {
			baseField.min = field.options?.min ?? 0;
			baseField.max = field.options?.max ?? 0; // 0 = no limit
			baseField.pattern = field.options?.pattern ?? '';
		} else if (field.type === 'number') {
			baseField.min = field.options?.min ?? null;
			baseField.max = field.options?.max ?? null;
			baseField.noDecimal = field.options?.noDecimal ?? false;
		} else if (field.type === 'bool') {
			// No additional options needed
		} else if (field.type === 'select') {
			baseField.values = field.options?.values ?? [];
			baseField.maxSelect = field.options?.maxSelect ?? 1;
		} else if (field.type === 'relation') {
			baseField.collectionId = field.options?.collectionId ?? '';
			baseField.cascadeDelete = field.options?.cascadeDelete ?? false;
			baseField.maxSelect = field.options?.maxSelect ?? 1;
		} else if (field.type === 'file') {
			baseField.maxSelect = field.options?.maxSelect ?? 1;
			baseField.maxSize = field.options?.maxSize ?? 5242880; // 5MB default
			baseField.mimeTypes = field.options?.mimeTypes ?? [];
		} else if (field.type === 'editor') {
			baseField.convertUrls = field.options?.convertUrls ?? false;
		} else if (field.options) {
			// For other types, spread any provided options
			Object.assign(baseField, field.options);
		}

		return baseField;
	});

	return {
		name: schema.name,
		type: schema.type,
		fields: fields, // PocketBase v0.23+ uses 'fields' not 'schema'
		indexes: schema.indexes ?? [],
		listRule: schema.listRule,
		viewRule: schema.viewRule,
		createRule: schema.createRule,
		updateRule: schema.updateRule,
		deleteRule: schema.deleteRule
	};
}

/**
 * Get a summary of what will be provisioned
 */
export function getProvisionSummary(collections: CollectionSchema[] = DEFAULT_COLLECTIONS): string {
	const lines = ['Collections to provision:', ''];
	for (const col of collections) {
		lines.push(`  • ${col.name} (${col.type})`);
		lines.push(`    Fields: ${col.fields.map(f => f.name).join(', ')}`);
	}
	return lines.join('\n');
}

