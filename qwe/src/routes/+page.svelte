<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import {
		pb,
		pbUrl,
		checkHealth,
		registerUser,
		loginWithEmail,
		logout,
		isAuthenticated,
		getCurrentUser,
		createRecord,
		getRecord,
		updateRecord,
		deleteRecord,
		listRecords,
		checkCollection,
	} from "$lib/pocketbase";
	import {
		type TestResult,
		type TestGroup,
		type TestStatus,
		createTest,
		createTestGroup,
		generateTestEmail,
		generateTestPassword,
		runTest,
		formatDuration,
		getGroupSummary,
	} from "$lib/test-utils";

	// ============================================
	// State
	// ============================================

	let testGroups = $state<TestGroup[]>([]);
	let isRunningAll = $state(false);
	let globalStatus = $state<"idle" | "running" | "complete">("idle");
	let realtimeEvents = $state<
		Array<{ time: string; action: string; data: string }>
	>([]);
	let unsubscribe: (() => void) | null = null;

	// Test data that persists across tests
	let testUserEmail = "";
	let testUserPassword = "";
	let testUserId = "";
	let testRecordId = "";

	// ============================================
	// Initialize Test Groups
	// ============================================

	function initializeTests() {
		testGroups = [
			createTestGroup(
				"connection",
				"Connection & Health",
				"🔌",
				"Verify PocketBase server connectivity",
				[
					createTest(
						"health",
						"Health Check",
						"Verify API is responding",
					),
					createTest(
						"version",
						"SDK Ready",
						"Verify PocketBase SDK is initialized",
					),
				],
			),
			createTestGroup(
				"auth",
				"Authentication",
				"🔐",
				"Test user registration, login, and session management",
				[
					createTest(
						"register",
						"User Registration",
						"Create a new test user account",
					),
					createTest(
						"login",
						"User Login",
						"Authenticate with email and password",
					),
					createTest(
						"session",
						"Session Validation",
						"Verify auth token is valid",
					),
					createTest(
						"logout",
						"User Logout",
						"Clear authentication session",
					),
				],
			),
			createTestGroup(
				"crud",
				"CRUD Operations",
				"📝",
				"Test Create, Read, Update, Delete operations",
				[
					createTest(
						"collection-check",
						"Collection Check",
						"Verify test collection exists",
					),
					createTest(
						"create",
						"Create Record",
						"Insert a new record",
					),
					createTest(
						"read",
						"Read Record",
						"Retrieve the created record",
					),
					createTest(
						"update",
						"Update Record",
						"Modify the record data",
					),
					createTest(
						"list",
						"List Records",
						"Query multiple records",
					),
					createTest(
						"delete",
						"Delete Record",
						"Remove the test record",
					),
				],
			),
			createTestGroup(
				"realtime",
				"Realtime",
				"⚡",
				"Test live data subscriptions",
				[
					createTest(
						"subscribe",
						"Subscribe",
						"Connect to realtime updates",
					),
					createTest(
						"receive",
						"Receive Event",
						"Trigger and receive a change event",
					),
					createTest(
						"unsubscribe",
						"Unsubscribe",
						"Disconnect from realtime",
					),
				],
			),
		];
	}

	// ============================================
	// Test Runners
	// ============================================

	function updateTest(
		groupId: string,
		testId: string,
		updates: Partial<TestResult>,
	) {
		testGroups = testGroups.map((group) => {
			if (group.id === groupId) {
				return {
					...group,
					tests: group.tests.map((test) => {
						if (test.id === testId) {
							return { ...test, ...updates };
						}
						return test;
					}),
				};
			}
			return group;
		});
	}

	async function runConnectionTests() {
		// Health Check
		updateTest("connection", "health", { status: "running" });
		const healthResult = await runTest(async () => {
			const health = await checkHealth();
			if (!health.healthy) throw new Error(health.message);
			return health;
		});
		updateTest("connection", "health", {
			status: healthResult.success ? "passed" : "failed",
			duration: healthResult.duration,
			error: healthResult.error,
			details: healthResult.success
				? `API Status: ${healthResult.result?.message}`
				: undefined,
		});

		if (!healthResult.success) {
			updateTest("connection", "version", {
				status: "skipped",
				error: "Server not reachable",
			});
			return false;
		}

		// Server Info (SDK version check)
		updateTest("connection", "version", { status: "running" });
		const versionResult = await runTest(async () => {
			// Verify PocketBase SDK is properly loaded by checking instance
			if (!pb || typeof pb.collection !== "function") {
				throw new Error("PocketBase SDK not properly initialized");
			}
			return { sdkLoaded: true, baseUrl: pb.baseURL };
		});
		updateTest("connection", "version", {
			status: versionResult.success ? "passed" : "failed",
			duration: versionResult.duration,
			error: versionResult.error,
			details: versionResult.success
				? `SDK Ready • Base URL: ${versionResult.result?.baseUrl}`
				: undefined,
		});

		return healthResult.success;
	}

	async function runAuthTests(skipLogout = false) {
		// Generate unique credentials
		testUserEmail = generateTestEmail();
		testUserPassword = generateTestPassword();

		// Register
		updateTest("auth", "register", { status: "running" });
		const registerResult = await runTest(async () => {
			const user = await registerUser(
				testUserEmail,
				testUserPassword,
				testUserPassword,
				"Test User",
			);
			testUserId = user.id;
			return user;
		});
		updateTest("auth", "register", {
			status: registerResult.success ? "passed" : "failed",
			duration: registerResult.duration,
			error: registerResult.error,
			details: registerResult.success
				? `Created user: ${testUserEmail}`
				: undefined,
		});

		if (!registerResult.success) {
			updateTest("auth", "login", {
				status: "skipped",
				error: "Registration failed",
			});
			updateTest("auth", "session", {
				status: "skipped",
				error: "Registration failed",
			});
			updateTest("auth", "logout", {
				status: "skipped",
				error: "Registration failed",
			});
			return false;
		}

		// Login
		updateTest("auth", "login", { status: "running" });
		const loginResult = await runTest(async () => {
			return await loginWithEmail(testUserEmail, testUserPassword);
		});
		updateTest("auth", "login", {
			status: loginResult.success ? "passed" : "failed",
			duration: loginResult.duration,
			error: loginResult.error,
			details: loginResult.success
				? `Token received (${loginResult.result?.token.substring(0, 20)}...)`
				: undefined,
		});

		if (!loginResult.success) {
			updateTest("auth", "session", {
				status: "skipped",
				error: "Login failed",
			});
			updateTest("auth", "logout", {
				status: "skipped",
				error: "Login failed",
			});
			return false;
		}

		// Session Validation
		updateTest("auth", "session", { status: "running" });
		const sessionResult = await runTest(async () => {
			if (!isAuthenticated()) throw new Error("Not authenticated");
			const user = getCurrentUser();
			if (!user) throw new Error("No user in session");
			return user;
		});
		updateTest("auth", "session", {
			status: sessionResult.success ? "passed" : "failed",
			duration: sessionResult.duration,
			error: sessionResult.error,
			details: sessionResult.success
				? `Session valid for: ${sessionResult.result?.email}`
				: undefined,
		});

		// Skip logout if we need to stay authenticated for subsequent tests
		if (skipLogout) {
			return true;
		}

		// Logout
		await runLogoutTest();

		return true;
	}

	async function runLogoutTest() {
		updateTest("auth", "logout", { status: "running" });
		const logoutResult = await runTest(async () => {
			logout();
			if (isAuthenticated())
				throw new Error("Still authenticated after logout");
			return true;
		});
		updateTest("auth", "logout", {
			status: logoutResult.success ? "passed" : "failed",
			duration: logoutResult.duration,
			error: logoutResult.error,
			details: logoutResult.success
				? "Session cleared successfully"
				: undefined,
		});
	}

	async function runCrudTests() {
		const TEST_COLLECTION = "test_items";

		// Collection Check
		updateTest("crud", "collection-check", { status: "running" });
		const collectionResult = await runTest(async () => {
			const result = await checkCollection(TEST_COLLECTION);
			if (!result.exists) {
				throw new Error(
					result.error ||
						`Collection "${TEST_COLLECTION}" not found.`,
				);
			}
			if (!result.accessible) {
				throw new Error(
					result.error ||
						`Collection "${TEST_COLLECTION}" is not accessible.`,
				);
			}
			return result;
		});
		updateTest("crud", "collection-check", {
			status: collectionResult.success ? "passed" : "failed",
			duration: collectionResult.duration,
			error: collectionResult.error,
			details: collectionResult.success
				? `Collection "${TEST_COLLECTION}" exists and accessible`
				: undefined,
		});

		if (!collectionResult.success) {
			const skipReason = collectionResult.error?.includes("API rules")
				? "API rules block access"
				: "Collection not found";
			["create", "read", "update", "list", "delete"].forEach((id) => {
				updateTest("crud", id, {
					status: "skipped",
					error: skipReason,
				});
			});
			return false;
		}

		// Create
		updateTest("crud", "create", { status: "running" });
		const createResult = await runTest(async () => {
			const record = await createRecord(TEST_COLLECTION, {
				title: "Test Item",
				description: `Created at ${new Date().toISOString()}`,
				status: "active",
			});
			testRecordId = record.id;
			return record;
		});
		updateTest("crud", "create", {
			status: createResult.success ? "passed" : "failed",
			duration: createResult.duration,
			error: createResult.error,
			details: createResult.success
				? `Created record ID: ${testRecordId}`
				: undefined,
		});

		if (!createResult.success) {
			["read", "update", "list", "delete"].forEach((id) => {
				updateTest("crud", id, {
					status: "skipped",
					error: "Create failed",
				});
			});
			return false;
		}

		// Read
		updateTest("crud", "read", { status: "running" });
		const readResult = await runTest(async () => {
			return await getRecord(TEST_COLLECTION, testRecordId);
		});
		updateTest("crud", "read", {
			status: readResult.success ? "passed" : "failed",
			duration: readResult.duration,
			error: readResult.error,
			details: readResult.success
				? `Retrieved: "${readResult.result?.title}"`
				: undefined,
		});

		// Update
		updateTest("crud", "update", { status: "running" });
		const updateResult = await runTest(async () => {
			return await updateRecord(TEST_COLLECTION, testRecordId, {
				title: "Updated Test Item",
				status: "modified",
			});
		});
		updateTest("crud", "update", {
			status: updateResult.success ? "passed" : "failed",
			duration: updateResult.duration,
			error: updateResult.error,
			details: updateResult.success
				? `Updated to: "${updateResult.result?.title}"`
				: undefined,
		});

		// List
		updateTest("crud", "list", { status: "running" });
		const listResult = await runTest(async () => {
			return await listRecords(TEST_COLLECTION, 1, 10);
		});
		updateTest("crud", "list", {
			status: listResult.success ? "passed" : "failed",
			duration: listResult.duration,
			error: listResult.error,
			details: listResult.success
				? `Found ${listResult.result?.totalItems} record(s)`
				: undefined,
		});

		// Delete
		updateTest("crud", "delete", { status: "running" });
		const deleteResult = await runTest(async () => {
			await deleteRecord(TEST_COLLECTION, testRecordId);
			return true;
		});
		updateTest("crud", "delete", {
			status: deleteResult.success ? "passed" : "failed",
			duration: deleteResult.duration,
			error: deleteResult.error,
			details: deleteResult.success
				? `Deleted record ${testRecordId}`
				: undefined,
		});

		return true;
	}

	async function runRealtimeTests() {
		const TEST_COLLECTION = "test_items";

		// Check collection first
		const collectionCheck = await checkCollection(TEST_COLLECTION);
		if (!collectionCheck.exists || !collectionCheck.accessible) {
			const skipReason = collectionCheck.error?.includes("API rules")
				? "API rules block access"
				: "Collection not found";
			["subscribe", "receive", "unsubscribe"].forEach((id) => {
				updateTest("realtime", id, {
					status: "skipped",
					error: skipReason,
				});
			});
			return false;
		}

		// Subscribe
		updateTest("realtime", "subscribe", { status: "running" });
		let eventReceived = false;
		const subscribeResult = await runTest(async () => {
			return new Promise<boolean>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Subscription timeout")),
					5000,
				);
				unsubscribe = () =>
					pb.collection(TEST_COLLECTION).unsubscribe("*");
				pb.collection(TEST_COLLECTION).subscribe("*", (e) => {
					eventReceived = true;
					realtimeEvents = [
						...realtimeEvents,
						{
							time: new Date().toLocaleTimeString(),
							action: e.action,
							data:
								JSON.stringify(e.record).substring(0, 50) +
								"...",
						},
					];
				});
				// Give subscription time to connect
				setTimeout(() => {
					clearTimeout(timeout);
					resolve(true);
				}, 1000);
			});
		});
		updateTest("realtime", "subscribe", {
			status: subscribeResult.success ? "passed" : "failed",
			duration: subscribeResult.duration,
			error: subscribeResult.error,
			details: subscribeResult.success
				? "Subscribed to collection changes"
				: undefined,
		});

		if (!subscribeResult.success) {
			updateTest("realtime", "receive", {
				status: "skipped",
				error: "Subscribe failed",
			});
			updateTest("realtime", "unsubscribe", {
				status: "skipped",
				error: "Subscribe failed",
			});
			return false;
		}

		// Receive Event (trigger by creating a record)
		updateTest("realtime", "receive", { status: "running" });
		const receiveResult = await runTest(async () => {
			// Create a record to trigger an event
			const record = await createRecord(TEST_COLLECTION, {
				title: "Realtime Test",
				description: "Triggered for realtime test",
				status: "test",
			});
			// Wait for event
			await new Promise((resolve) => setTimeout(resolve, 1500));
			// Clean up
			await deleteRecord(TEST_COLLECTION, record.id);
			if (!eventReceived) {
				throw new Error("No realtime event received");
			}
			return true;
		});
		updateTest("realtime", "receive", {
			status: receiveResult.success ? "passed" : "failed",
			duration: receiveResult.duration,
			error: receiveResult.error,
			details: receiveResult.success
				? "Received realtime event"
				: undefined,
		});

		// Unsubscribe
		updateTest("realtime", "unsubscribe", { status: "running" });
		const unsubscribeResult = await runTest(async () => {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
			return true;
		});
		updateTest("realtime", "unsubscribe", {
			status: unsubscribeResult.success ? "passed" : "failed",
			duration: unsubscribeResult.duration,
			error: unsubscribeResult.error,
			details: unsubscribeResult.success
				? "Unsubscribed successfully"
				: undefined,
		});

		return true;
	}

	async function runAllTests() {
		isRunningAll = true;
		globalStatus = "running";
		initializeTests();

		await runConnectionTests();
		// Skip logout during auth tests - we need to stay authenticated for CRUD/Realtime
		await runAuthTests(true);
		await runCrudTests();
		await runRealtimeTests();
		// Now run logout test at the end
		await runLogoutTest();

		globalStatus = "complete";
		isRunningAll = false;
	}

	async function runGroupTests(groupId: string) {
		switch (groupId) {
			case "connection":
				await runConnectionTests();
				break;
			case "auth":
				await runAuthTests();
				break;
			case "crud":
				// Ensure user is authenticated before running CRUD tests
				if (!isAuthenticated()) {
					await runAuthTests(true); // skipLogout = true
				}
				await runCrudTests();
				break;
			case "realtime":
				// Ensure user is authenticated before running Realtime tests
				if (!isAuthenticated()) {
					await runAuthTests(true); // skipLogout = true
				}
				await runRealtimeTests();
				break;
		}
	}

	// ============================================
	// Lifecycle
	// ============================================

	onMount(() => {
		initializeTests();
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	// ============================================
	// Computed Values
	// ============================================

	function getStatusIcon(status: TestStatus): string {
		switch (status) {
			case "passed":
				return "✓";
			case "failed":
				return "✗";
			case "running":
				return "◌";
			case "skipped":
				return "○";
			default:
				return "○";
		}
	}

	function getTotalSummary() {
		const allTests = testGroups.flatMap((g) => g.tests);
		return getGroupSummary(allTests);
	}
</script>

<svelte:head>
	<title>FStack - PocketBase Integration Test Suite</title>
</svelte:head>

<main>
	<div class="container">
		<!-- Summary Bar -->
		<div class="summary-bar">
			<div class="summary-stats">
				{#if globalStatus === "complete"}
					{@const summary = getTotalSummary()}
					<span class="stat passed">{summary.passed} passed</span>
					<span class="stat failed">{summary.failed} failed</span>
					<span class="stat total">{summary.total} total</span>
				{:else if globalStatus === "running"}
					<span class="stat running">Running tests...</span>
				{:else}
					<span class="stat idle">Ready to run tests</span>
				{/if}
			</div>
			<button
				class="run-all-btn"
				onclick={runAllTests}
				disabled={isRunningAll}
			>
				{#if isRunningAll}
					<span class="spinner"></span>
					Running...
				{:else}
					▶ Run All Tests
				{/if}
			</button>
		</div>

		<!-- Test Groups -->
		<div class="test-groups">
			{#each testGroups as group}
				{@const summary = getGroupSummary(group.tests)}
				<div class="test-group">
					<div class="group-header">
						<div class="group-info">
							<span class="group-icon">{group.icon}</span>
							<div class="group-text">
								<h2>{group.name}</h2>
								<p>{group.description}</p>
							</div>
						</div>
						<div class="group-actions">
							<div class="group-summary">
								{#if summary.passed > 0}
									<span class="mini-stat passed"
										>{summary.passed}</span
									>
								{/if}
								{#if summary.failed > 0}
									<span class="mini-stat failed"
										>{summary.failed}</span
									>
								{/if}
							</div>
							<button
								class="run-group-btn"
								onclick={() => runGroupTests(group.id)}
								disabled={isRunningAll}
							>
								▶
							</button>
						</div>
					</div>
					<div class="tests-list">
						{#each group.tests as test}
							<div class="test-item {test.status}">
								<div class="test-status">
									{#if test.status === "running"}
										<span class="spinner small"></span>
									{:else}
										<span class="status-icon {test.status}"
											>{getStatusIcon(test.status)}</span
										>
									{/if}
								</div>
								<div class="test-info">
									<span class="test-name">{test.name}</span>
									<span class="test-desc"
										>{test.description}</span
									>
									{#if test.details}
										<span class="test-details"
											>{test.details}</span
										>
									{/if}
									{#if test.error}
										<span class="test-error"
											>{test.error}</span
										>
									{/if}
								</div>
								{#if test.duration}
									<span class="test-duration"
										>{formatDuration(test.duration)}</span
									>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Realtime Events Log -->
		{#if realtimeEvents.length > 0}
			<div class="realtime-log">
				<h3>📡 Realtime Events</h3>
				<div class="events-list">
					{#each realtimeEvents as event}
						<div class="event-item">
							<span class="event-time">{event.time}</span>
							<span class="event-action {event.action}"
								>{event.action}</span
							>
							<span class="event-data">{event.data}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Setup Instructions -->
		<div class="setup-card">
			<h3>📋 Required Setup</h3>
			<p>
				<strong>Step 1:</strong> Create a <code>test_items</code> collection
				with these fields:
			</p>
			<div class="field-list">
				<div class="field">
					<code>title</code> <span class="field-type">Text</span>
				</div>
				<div class="field">
					<code>description</code>
					<span class="field-type">Text</span>
				</div>
				<div class="field">
					<code>status</code> <span class="field-type">Text</span>
				</div>
			</div>
			<p>
				<strong>Step 2:</strong> Set API Rules (in collection settings →
				API Rules tab):
			</p>
			<div class="api-rules">
				<div class="rule">
					List/Search: <code>@request.auth.id != ""</code>
				</div>
				<div class="rule">
					View: <code>@request.auth.id != ""</code>
				</div>
				<div class="rule">
					Create: <code>@request.auth.id != ""</code>
				</div>
				<div class="rule">
					Update: <code>@request.auth.id != ""</code>
				</div>
				<div class="rule">
					Delete: <code>@request.auth.id != ""</code>
				</div>
			</div>
			<p class="setup-note">
				<a href="{pbUrl}/_/" target="_blank" rel="noopener"
					>Open PocketBase Admin →</a
				>
			</p>
		</div>

		<!-- Footer -->
		<footer>
			<p>
				FStack Integration Test Suite • Built with SvelteKit +
				PocketBase
			</p>
		</footer>
	</div>
</main>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family:
			"Geist",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		background: #09090b;
		color: #fafafa;
		line-height: 1.6;
	}

	main {
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	/* Summary Bar */
	.summary-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: #18181b;
		border-radius: 12px;
		margin-bottom: 1.5rem;
		border: 1px solid #27272a;
	}

	.summary-stats {
		display: flex;
		gap: 1rem;
	}

	.stat {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.stat.passed {
		color: #22c55e;
	}
	.stat.failed {
		color: #ef4444;
	}
	.stat.running {
		color: #eab308;
	}
	.stat.total {
		color: #71717a;
	}
	.stat.idle {
		color: #71717a;
	}

	.run-all-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: #22c55e;
		color: #09090b;
		border: none;
		border-radius: 8px;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.run-all-btn:hover:not(:disabled) {
		background: #16a34a;
	}

	.run-all-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Test Groups */
	.test-groups {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.test-group {
		background: #18181b;
		border-radius: 12px;
		border: 1px solid #27272a;
		overflow: hidden;
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: #1c1c1f;
		border-bottom: 1px solid #27272a;
	}

	.group-info {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.group-icon {
		font-size: 1.25rem;
	}

	.group-text h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: 0.125rem;
	}

	.group-text p {
		font-size: 0.8125rem;
		color: #71717a;
	}

	.group-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.group-summary {
		display: flex;
		gap: 0.5rem;
	}

	.mini-stat {
		font-family: "Geist Mono", monospace;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.mini-stat.passed {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
	}

	.mini-stat.failed {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.run-group-btn {
		width: 32px;
		height: 32px;
		background: #27272a;
		border: none;
		border-radius: 6px;
		color: #a1a1aa;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.75rem;
	}

	.run-group-btn:hover:not(:disabled) {
		background: #3f3f46;
		color: #fafafa;
	}

	.run-group-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Tests List */
	.tests-list {
		display: flex;
		flex-direction: column;
	}

	.test-item {
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid #27272a;
		transition: background 0.15s ease;
	}

	.test-item:last-child {
		border-bottom: none;
	}

	.test-item:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.test-status {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.status-icon {
		font-family: "Geist Mono", monospace;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.status-icon.passed {
		color: #22c55e;
	}
	.status-icon.failed {
		color: #ef4444;
	}
	.status-icon.skipped {
		color: #71717a;
	}
	.status-icon.idle {
		color: #3f3f46;
	}

	.test-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.test-name {
		font-weight: 500;
		font-size: 0.875rem;
	}

	.test-desc {
		font-size: 0.8125rem;
		color: #71717a;
	}

	.test-details {
		font-family: "Geist Mono", monospace;
		font-size: 0.75rem;
		color: #22c55e;
		margin-top: 0.25rem;
	}

	.test-error {
		font-family: "Geist Mono", monospace;
		font-size: 0.75rem;
		color: #ef4444;
		margin-top: 0.25rem;
	}

	.test-duration {
		font-family: "Geist Mono", monospace;
		font-size: 0.75rem;
		color: #71717a;
		flex-shrink: 0;
	}

	/* Spinner */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(234, 179, 8, 0.3);
		border-top-color: #eab308;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.spinner.small {
		width: 14px;
		height: 14px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Realtime Log */
	.realtime-log {
		margin-top: 1.5rem;
		padding: 1.25rem;
		background: #18181b;
		border-radius: 12px;
		border: 1px solid #27272a;
	}

	.realtime-log h3 {
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.event-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #09090b;
		border-radius: 6px;
		font-family: "Geist Mono", monospace;
		font-size: 0.75rem;
	}

	.event-time {
		color: #71717a;
	}

	.event-action {
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
		text-transform: uppercase;
		font-size: 0.6875rem;
	}

	.event-action.create {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
	}

	.event-action.update {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.event-action.delete {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.event-data {
		color: #a1a1aa;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Setup Card */
	.setup-card {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: linear-gradient(
			135deg,
			rgba(59, 130, 246, 0.08) 0%,
			rgba(139, 92, 246, 0.08) 100%
		);
		border-radius: 12px;
		border: 1px solid rgba(59, 130, 246, 0.2);
	}

	.setup-card h3 {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.setup-card p {
		font-size: 0.875rem;
		color: #a1a1aa;
		margin-bottom: 1rem;
	}

	.setup-card code {
		font-family: "Geist Mono", monospace;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		color: #fafafa;
	}

	.field-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		font-size: 0.8125rem;
	}

	.field code {
		background: none;
		padding: 0;
		color: #fafafa;
	}

	.field-type {
		font-size: 0.75rem;
		color: #71717a;
	}

	.api-rules {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
	}

	.rule {
		font-size: 0.8125rem;
		color: #a1a1aa;
	}

	.rule code {
		font-family: "Geist Mono", monospace;
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.setup-note {
		margin-bottom: 0;
	}

	.setup-note a {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
	}

	.setup-note a:hover {
		text-decoration: underline;
	}

	/* Footer */
	footer {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid #27272a;
		text-align: center;
	}

	footer p {
		font-size: 0.8125rem;
		color: #52525b;
	}

	/* Responsive */
	@media (max-width: 640px) {
		main {
			padding: 1rem;
		}

		.summary-bar {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.run-all-btn {
			justify-content: center;
		}

		.group-header {
			flex-direction: column;
			gap: 0.75rem;
			align-items: flex-start;
		}

		.group-actions {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
