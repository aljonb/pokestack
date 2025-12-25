// Collection schema definitions for auto-provisioning
// These schemas define the structure of collections that will be created automatically

export interface FieldSchema {
	name: string;
	type: 'text' | 'number' | 'bool' | 'email' | 'url' | 'date' | 'select' | 'json' | 'file' | 'relation' | 'editor';
	required?: boolean;
	options?: Record<string, unknown>;
}

export interface CollectionSchema {
	name: string;
	type: 'base' | 'auth' | 'view';
	fields: FieldSchema[];
	indexes?: string[];
	// API Rules - empty string means public, null means locked
	listRule?: string | null;
	viewRule?: string | null;
	createRule?: string | null;
	updateRule?: string | null;
	deleteRule?: string | null;
}

// ============================================
// Default Collections
// ============================================

/**
 * Test items collection - used for integration testing
 * Demonstrates basic CRUD operations and realtime subscriptions
 */
export const testItemsCollection: CollectionSchema = {
	name: 'test_items',
	type: 'base',
	fields: [
		{ name: 'title', type: 'text', required: true },
		{ name: 'description', type: 'text', required: false },
		{ name: 'status', type: 'text', required: false }
	],
	// Require authentication for all operations
	listRule: '@request.auth.id != ""',
	viewRule: '@request.auth.id != ""',
	createRule: '@request.auth.id != ""',
	updateRule: '@request.auth.id != ""',
	deleteRule: '@request.auth.id != ""'
};

/**
 * Tweets collection - public timeline
 */
export const tweetsCollection: CollectionSchema = {
	name: 'tweets',
	type: 'base',
	fields: [
		{ name: 'content', type: 'text', required: true }
	],
	// Allow any visitor to list and create
	listRule: '',
	viewRule: '',
	createRule: '',
	updateRule: '@request.auth.id != ""', // Only auth users can edit (though we won't expose editing in UI)
	deleteRule: '@request.auth.id != ""'
};

/**
 * All collections that should be auto-provisioned
 * Add new collections here to have them created automatically
 */
export const DEFAULT_COLLECTIONS: CollectionSchema[] = [
	testItemsCollection,
	tweetsCollection
];

// ============================================
// Schema Helpers
// ============================================

/**
 * Create a collection schema with common defaults
 */
export function createCollectionSchema(
	name: string,
	fields: FieldSchema[],
	options: Partial<Omit<CollectionSchema, 'name' | 'fields'>> = {}
): CollectionSchema {
	return {
		name,
		type: options.type ?? 'base',
		fields,
		listRule: options.listRule ?? '@request.auth.id != ""',
		viewRule: options.viewRule ?? '@request.auth.id != ""',
		createRule: options.createRule ?? '@request.auth.id != ""',
		updateRule: options.updateRule ?? '@request.auth.id != ""',
		deleteRule: options.deleteRule ?? '@request.auth.id != ""',
		indexes: options.indexes
	};
}

/**
 * Create a public collection (no auth required)
 */
export function createPublicCollectionSchema(
	name: string,
	fields: FieldSchema[],
	options: Partial<Omit<CollectionSchema, 'name' | 'fields'>> = {}
): CollectionSchema {
	return {
		name,
		type: options.type ?? 'base',
		fields,
		listRule: '',
		viewRule: '',
		createRule: options.createRule ?? '@request.auth.id != ""', // Still require auth for writes
		updateRule: options.updateRule ?? '@request.auth.id != ""',
		deleteRule: options.deleteRule ?? '@request.auth.id != ""',
		indexes: options.indexes
	};
}

