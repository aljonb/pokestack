// Setup module exports
// Provides auto-provisioning functionality for PocketBase collections

export {
	type CollectionSchema,
	type FieldSchema,
	DEFAULT_COLLECTIONS,
	testItemsCollection,
	createCollectionSchema,
	createPublicCollectionSchema
} from './schemas.js';

export {
	type ProvisionResult,
	type ProvisionOptions,
	provisionCollections,
	checkPocketBaseHealth,
	validateAdminCredentials,
	getProvisionSummary
} from './provision.js';

