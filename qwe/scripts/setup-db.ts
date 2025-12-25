#!/usr/bin/env node
/**
 * Database Setup Script
 * 
 * Automatically provisions PocketBase collections for the FStack boilerplate.
 * 
 * Usage:
 *   npm run setup
 *   
 * Environment Variables:
 *   PB_URL          - PocketBase server URL (default: http://127.0.0.1:8090)
 *   PB_ADMIN_EMAIL  - Admin email
 *   PB_ADMIN_PASS   - Admin password
 * 
 * If credentials are not provided via env vars, the script will prompt for them.
 */

import 'dotenv/config';
import * as readline from 'readline';
import {
	provisionCollections,
	checkPocketBaseHealth,
	getProvisionSummary,
	DEFAULT_COLLECTIONS
} from '../src/lib/setup/index.js';

// ============================================
// Configuration
// ============================================

const DEFAULT_PB_URL = 'http://127.0.0.1:8090';

// ANSI colors for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m'
};

// ============================================
// Helpers
// ============================================

function log(message: string, color: keyof typeof colors = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: string) {
	console.log(`\n${colors.cyan}▸${colors.reset} ${step}`);
}

function logSuccess(message: string) {
	console.log(`  ${colors.green}✓${colors.reset} ${message}`);
}

function logError(message: string) {
	console.log(`  ${colors.red}✗${colors.reset} ${message}`);
}

function logInfo(message: string) {
	console.log(`  ${colors.dim}${message}${colors.reset}`);
}

async function prompt(question: string, hidden = false): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve) => {
		if (hidden) {
			// For password input, we need to handle it differently
			process.stdout.write(question);
			let input = '';

			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.setEncoding('utf8');

			const onData = (char: string) => {
				if (char === '\n' || char === '\r') {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.removeListener('data', onData);
					console.log();
					rl.close();
					resolve(input);
				} else if (char === '\u0003') {
					// Ctrl+C
					process.exit();
				} else if (char === '\u007F' || char === '\b') {
					// Backspace
					if (input.length > 0) {
						input = input.slice(0, -1);
					}
				} else {
					input += char;
				}
			};

			process.stdin.on('data', onData);
		} else {
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer);
			});
		}
	});
}

async function promptWithDefault(question: string, defaultValue: string): Promise<string> {
	const answer = await prompt(`${question} (${defaultValue}): `);
	return answer.trim() || defaultValue;
}

// ============================================
// Main
// ============================================

async function main() {
	console.log();
	log('╔══════════════════════════════════════════╗', 'cyan');
	log('║     FStack Database Setup                ║', 'cyan');
	log('║     Auto-provision PocketBase            ║', 'cyan');
	log('╚══════════════════════════════════════════╝', 'cyan');
	console.log();

	// Get configuration from env vars or prompts
	const pbUrl = process.env.PB_URL || await promptWithDefault('PocketBase URL', DEFAULT_PB_URL);

	// Step 1: Check PocketBase health
	logStep('Checking PocketBase server...');
	const health = await checkPocketBaseHealth(pbUrl);

	if (!health.healthy) {
		logError(`Cannot connect to PocketBase at ${pbUrl}`);
		logInfo(health.message);
		console.log();
		log('Make sure PocketBase is running:', 'yellow');
		log('  ./pocketbase serve', 'dim');
		console.log();
		process.exit(1);
	}

	logSuccess(`Connected to ${pbUrl}`);

	// Step 2: Get admin credentials
	logStep('Admin authentication required');

	let adminEmail = process.env.PB_ADMIN_EMAIL;
	let adminPassword = process.env.PB_ADMIN_PASS;

	if (!adminEmail || !adminPassword) {
		logInfo('Enter your PocketBase admin credentials');
		logInfo('(Create an admin at ' + pbUrl + '/_/)');
		console.log();

		if (!adminEmail) {
			adminEmail = await prompt('  Admin email: ');
		}
		if (!adminPassword) {
			adminPassword = await prompt('  Admin password: ', true);
		}
	} else {
		logInfo('Using credentials from environment variables');
	}

	// Step 2.6: Prepare OAuth settings if available
	const googleClientId = process.env.GOOGLE_CLIENT_ID;
	const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
	let settings: Record<string, any> | undefined = undefined;

	if (googleClientId && googleClientSecret) {
		logInfo('Google OAuth credentials detected in environment');
		settings = {
			googleAuth: {
				enabled: true,
				clientId: googleClientId,
				clientSecret: googleClientSecret
			}
		};
	}

	// Step 3: Show what will be provisioned
	logStep('Collections to provision');
	console.log();
	for (const col of DEFAULT_COLLECTIONS) {
		log(`  ${colors.magenta}•${colors.reset} ${colors.bright}${col.name}${colors.reset} (${col.type})`);
		log(`    Fields: ${col.fields.map(f => f.name).join(', ')}`, 'dim');
	}

	// Step 4: Run provisioning
	logStep('Provisioning collections...');
	console.log();

	const result = await provisionCollections({
		pbUrl,
		adminEmail,
		adminPassword,
		settings,
		onProgress: (msg) => {
			if (msg.startsWith('✓')) {
				logSuccess(msg.substring(2));
			} else if (msg.startsWith('✗')) {
				logError(msg.substring(2));
			} else if (msg.startsWith('○')) {
				logInfo(msg.substring(2));
			} else {
				logInfo(msg);
			}
		}
	});

	// Step 5: Report results
	console.log();
	log('════════════════════════════════════════════', 'dim');
	console.log();

	if (result.success) {
		log('✅ Setup complete!', 'green');
		console.log();

		if (result.created.length > 0) {
			log(`   Created: ${result.created.join(', ')}`, 'green');
		}
		if (result.skipped.length > 0) {
			log(`   Skipped: ${result.skipped.join(', ')} (already exist)`, 'dim');
		}

		console.log();
		log('Your PocketBase is ready! Run your tests:', 'cyan');
		log('  npm run dev', 'dim');
		console.log();
	} else {
		log('❌ Setup failed', 'red');
		console.log();

		for (const err of result.errors) {
			log(`   ${err.collection}: ${err.error}`, 'red');
		}

		console.log();
		log('Troubleshooting:', 'yellow');
		log('  1. Make sure PocketBase is running', 'dim');
		log('  2. Verify admin credentials are correct', 'dim');
		log('  3. Check PocketBase admin UI: ' + pbUrl + '/_/', 'dim');
		console.log();

		process.exit(1);
	}
}

// Run
main().catch((err) => {
	logError(`Unexpected error: ${err.message}`);
	process.exit(1);
});

