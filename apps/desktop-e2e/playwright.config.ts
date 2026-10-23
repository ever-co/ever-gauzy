import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { runDir } from './src/support/config';

/**
 * Desktop end-to-end suite: drives the packaged Electron apps over the Chrome DevTools Protocol with
 * Playwright, against a real API (see README.md). Run: `yarn nx e2e desktop-e2e`.
 *
 * Unless DESKTOP_E2E_API_URL points at a running API, the global setup starts the built API
 * (`dist/apps/api`) on a FRESH SQLite database with the demo seed and waits for the seed to finish.
 */
mkdirSync(runDir, { recursive: true });

export default defineConfig({
	testDir: './src',
	testMatch: '**/*.spec.ts',
	globalSetup: './src/global-setup.ts',
	// One app, one API, one account: everything runs in order in one worker.
	workers: 1,
	fullyParallel: false,
	// Setup, login, at least one periodic screenshot interval (1 minute) and the checks.
	timeout: 40 * 60_000,
	expect: { timeout: 60_000 },
	retries: 0,
	forbidOnly: !!process.env['CI'],
	outputDir: join(runDir, 'test-results'),
	reporter: [['list'], ['html', { open: 'never', outputFolder: join(runDir, 'report') }]],
	use: {
		actionTimeout: 30_000
	}
});
