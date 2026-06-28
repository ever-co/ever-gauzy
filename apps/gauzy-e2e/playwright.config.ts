import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Ever Gauzy e2e suite.
 *
 * Migration target replacing Cypress (see cypress.json). Mirrors the Cypress
 * settings: baseURL http://localhost:4200, 1920x1080 viewport, generous timeouts
 * for the heavy Angular app. Run via `nx e2e gauzy-e2e` (Nx starts `gauzy:serve`)
 * or directly with `npx playwright test` against an already-running app.
 *
 * The legacy Cucumber `.feature` files are migrated in batches under `tests/`;
 * see knowledge runbook E2E_PLAYWRIGHT_MIGRATION.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4200';

export default defineConfig({
	testDir: './tests',
	/* Mirror Cypress defaultCommandTimeout (24s) for actions and a long nav timeout for the heavy app.
	 * 180s per test: the contact-mutation specs walk a 4-step stepper twice (add + edit) plus invite and
	 * delete, each with settle/retry waits for the app's async dropdowns and overlay-leaking dialogs. */
	timeout: 180_000,
	expect: { timeout: 24_000 },
	/* Fail the build on test.only left in source. */
	forbidOnly: !!process.env.CI,
	/* Retries: 0 while driving the migrated suite to all-green. retries=1 (the prior default) is roughly
	 * NEUTRAL on pass count here (measured 52 vs 53) — a retry can re-run a failed spec's data-creation
	 * and pollute the shared sqlite DB, offsetting the transient flakes it would otherwise absorb — but 0
	 * gives a clean, reproducible signal while diagnosing. Reconsider restoring 1 once specs are
	 * per-spec data-isolated. Override with E2E_RETRY=1 if a one-off retry is wanted locally. */
	retries: process.env.E2E_RETRY ? 1 : 0,
	/* Opt out of parallel within a file; shard across CI containers instead. */
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: '../../dist/playwright/apps/gauzy-e2e/junit.xml' }]]
		: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		actionTimeout: 24_000,
		navigationTimeout: 60_000,
		viewport: { width: 1920, height: 1080 },
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'off'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
