import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

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

// Restored BDD (Gherkin) layer via playwright-bdd: .feature files + step definitions -> generated
// Playwright specs. `bddgen` writes the specs into this dir and the 'bdd' project below runs them.
// The plain '*.spec.ts' tests keep running via the 'chromium' project until each is converted to a
// .feature — the two coexist during the transition. Step defs bind the shared page-object layer via
// tests/support/bdd.ts. Run: `npx bddgen && npx playwright test` (bddgen is also invoked by CI).
const bddTestDir = defineBddConfig({
	features: 'tests/bdd/features/**/*.feature',
	steps: ['tests/bdd/steps/**/*.ts', 'tests/support/bdd.ts']
});

export default defineConfig({
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
		// retain-on-failure (not on-first-retry): with retries=0 there IS no retry, so on-first-retry
		// captured nothing. This keeps a full trace for every failed test — essential for diagnosing the
		// suite remotely (the local rig can't run it), viewable via `npx playwright show-trace`.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'off'
	},
	projects: [
		{ name: 'chromium', testDir: './tests', testIgnore: ['bdd/**'], use: { ...devices['Desktop Chrome'] } },
		{ name: 'bdd', testDir: bddTestDir, use: { ...devices['Desktop Chrome'] } }
	]
});
