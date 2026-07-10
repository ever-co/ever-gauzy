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
	// 240s (was 180s): the send/email/set-status scenarios chain 7-9 CRUD ops in ONE Scenario, each with a
	// load-bearing 10s waitElementToHide settle (util.ts) — that exceeded 180s and the Send step ran out of
	// time before it could observe the Sent badge. 240s gives headroom without much waste (most tests finish
	// far under it). Fast tests are unaffected; only genuinely long/hung ones use the extra budget.
	timeout: 240_000,
	expect: { timeout: 24_000 },
	/* Fail the build on test.only left in source. */
	forbidOnly: !!process.env.CI,
	/* Retries: 2 in CI. The migrated suite runs serially against one accumulating sqlite DB in a heavy
	 * Angular app, so a residue of timing/overlay flakes is irreducible (Nebular popover click-toggles,
	 * multi-step stepper validity races, hash-router settle). Each retry runs in a FRESH browser context,
	 * so it absorbs those transient flakes; genuinely deterministic failures still fail all 3 attempts.
	 * A retry re-creates only the spec's OWN uniquely-named data (its scoped selectors ignore foreign
	 * rows), so it does not worsen cross-spec pollution. Local stays 0 for a clean signal (E2E_RETRY=1). */
	retries: process.env.CI ? 2 : process.env.E2E_RETRY ? 1 : 0,
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
