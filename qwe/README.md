# ⚡ FStack

**Full-stack starter kit** with SvelteKit + PocketBase integrated from the beginning.

> The goal of FStack is to provide a ready-to-use full-stack development environment similar to `create-next-app`, but with PocketBase as the backend — everything connected out of the box.

## 🚀 Quick Start

### 1. Start PocketBase Server

Download PocketBase from [pocketbase.io](https://pocketbase.io/docs/) and run:

```bash
./pocketbase serve
```

This starts the backend at `http://127.0.0.1:8090`

Create an admin account at `http://127.0.0.1:8090/_/`

### 2. Start the SvelteKit App

```bash
cd my-app
npm install
npm run dev
```

This starts the frontend at `http://localhost:5173`

### 3. Auto-Setup Database (One Command!)

Run the setup script to automatically create all required collections:

```bash
npm run setup
```

This will:
- ✅ Connect to PocketBase
- ✅ Authenticate as admin (prompts for credentials)
- ✅ Create the `test_items` collection with proper fields
- ✅ Configure API rules for authenticated access

**Using environment variables (CI/CD):**

```bash
PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASS=yourpassword npm run setup
```

### 4. Run the Integration Tests

Open your browser and navigate to `http://localhost:5173`. The test dashboard will show you the status of all PocketBase integrations — all tests should pass!

## 📋 Manual Test Suite Setup (Alternative)

If you prefer to manually create collections, add a `test_items` collection in PocketBase Admin (`http://127.0.0.1:8090/_/`):

| Field       | Type |
|-------------|------|
| `title`     | Text |
| `description` | Text |
| `status`    | Text |

> **Tip:** Set API Rules to `@request.auth.id != ""` for all operations.

## ✅ What Gets Tested

### Connection & Health
- Health Check — Verify PocketBase API is responding
- SDK Ready — Verify PocketBase SDK is properly initialized

### Authentication
- User Registration — Create new test user accounts
- User Login — Authenticate with email/password
- Session Validation — Verify auth tokens work
- User Logout — Clear authentication sessions

### CRUD Operations
- Collection Check — Verify test collection exists
- Create Record — Insert new records
- Read Record — Retrieve records by ID
- Update Record — Modify existing records
- List Records — Query multiple records with pagination
- Delete Record — Remove records

### Realtime
- Subscribe — Connect to live data updates
- Receive Event — Trigger and receive change events
- Unsubscribe — Disconnect from realtime

## 📁 Project Structure

```
my-app/
├── scripts/
│   └── setup-db.ts          # Auto-provision database collections
├── src/
│   ├── lib/
│   │   ├── pocketbase.ts    # PocketBase client & helper functions
│   │   ├── test-utils.ts    # Test utilities and types
│   │   └── setup/           # Setup & provisioning module
│   │       ├── schemas.ts   # Collection schema definitions
│   │       ├── provision.ts # Provisioning logic
│   │       └── index.ts     # Module exports
│   └── routes/
│       └── +page.svelte     # Integration test dashboard
├── package.json
└── README.md
```

## 🔧 Using PocketBase in Your App

Import the pre-configured client anywhere in your app:

```typescript
import { pb, isAuthenticated, getCurrentUser } from '$lib/pocketbase';

// Check authentication
if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log('Logged in as:', user?.email);
}

// Fetch records
const posts = await pb.collection('posts').getList(1, 20);

// Subscribe to changes
pb.collection('posts').subscribe('*', (e) => {
  console.log('Change:', e.action, e.record);
});
```

## 🛠 Available Helper Functions

```typescript
// Health & Connection
checkHealth()                    // Check if PocketBase is reachable

// Authentication
isAuthenticated()                // Check if user is logged in
getCurrentUser()                 // Get current user record
registerUser(email, password, passwordConfirm, name?)
loginWithEmail(email, password)
logout()
requestPasswordReset(email)
requestEmailVerification(email)

// CRUD Operations
createRecord(collection, data)
getRecord(collection, id)
updateRecord(collection, id, data)
deleteRecord(collection, id)
listRecords(collection, page?, perPage?, filter?, sort?)

// Realtime
subscribeToCollection(collection, callback)
subscribeToRecord(collection, recordId, callback)

// Files
getFileUrl(record, filename, queryParams?)
uploadFile(collection, recordId, fieldName, file)

// Utilities
collectionExists(collectionName)

// Setup & Provisioning
provisionCollections(options)      // Auto-create collections
checkPocketBaseHealth(url)         // Verify server is running
```

## ➕ Adding Custom Collections

Define your collection schemas in `src/lib/setup/schemas.ts`:

```typescript
import { createCollectionSchema, DEFAULT_COLLECTIONS } from '$lib/setup';

// Add your custom collection
const postsCollection = createCollectionSchema('posts', [
  { name: 'title', type: 'text', required: true },
  { name: 'content', type: 'editor' },
  { name: 'published', type: 'bool' }
]);

// Export all collections
export const MY_COLLECTIONS = [...DEFAULT_COLLECTIONS, postsCollection];
```

Then run `npm run setup` to provision them automatically.

## 📦 Tech Stack

- **Frontend:** SvelteKit 2 + Svelte 5
- **Backend:** PocketBase
- **Language:** TypeScript
- **Styling:** CSS (scoped)

## 🎯 Philosophy

FStack aims to be the fastest way to start a full-stack project with:

1. **Zero backend setup** — PocketBase is a single executable
2. **Type-safe by default** — Full TypeScript support
3. **Batteries included** — Auth, database, realtime, files all ready
4. **Test-first confidence** — Built-in integration test suite

---

Built with ❤️ using SvelteKit + PocketBase
