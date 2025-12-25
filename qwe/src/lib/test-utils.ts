// Test utilities and types for the PocketBase integration test suite

export type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestResult {
	id: string;
	name: string;
	description: string;
	status: TestStatus;
	duration?: number;
	error?: string;
	details?: string;
}

export interface TestGroup {
	id: string;
	name: string;
	icon: string;
	description: string;
	tests: TestResult[];
}

export function createTest(
	id: string,
	name: string,
	description: string,
	status: TestStatus = 'idle'
): TestResult {
	return { id, name, description, status };
}

export function createTestGroup(
	id: string,
	name: string,
	icon: string,
	description: string,
	tests: TestResult[]
): TestGroup {
	return { id, name, icon, description, tests };
}

// Generate a unique test email
export function generateTestEmail(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `test_${timestamp}_${random}@fstack.test`;
}

// Generate a secure test password
export function generateTestPassword(): string {
	return `TestPass_${Date.now()}_${Math.random().toString(36).substring(2, 10)}!`;
}

// Run a test with timing and error handling
export async function runTest<T>(
	testFn: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string; duration: number }> {
	const start = performance.now();
	try {
		const result = await testFn();
		const duration = Math.round(performance.now() - start);
		return { success: true, result, duration };
	} catch (error) {
		const duration = Math.round(performance.now() - start);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			duration
		};
	}
}

// Format duration for display
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

// Calculate test group summary
export function getGroupSummary(tests: TestResult[]): {
	total: number;
	passed: number;
	failed: number;
	running: number;
} {
	return {
		total: tests.length,
		passed: tests.filter((t) => t.status === 'passed').length,
		failed: tests.filter((t) => t.status === 'failed').length,
		running: tests.filter((t) => t.status === 'running').length
	};
}

