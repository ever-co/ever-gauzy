import { test, expect } from '@playwright/test';

/**
 * Login smoke test — the suite's one intentionally dependency-light canary.
 *
 * Everything else is now authored as playwright-bdd .feature files backed by the shared page-object
 * layer (see tests/bdd/). This spec is DELIBERATELY kept plain and self-contained: raw `@playwright/test`,
 * inline selectors, no page objects, no BDD fixtures, env-overridable creds. If the page-object / step
 * layer regresses, this still answers the first triage question — "can the super-admin log in at all?" —
 * independently of that layer. Keep it minimal and coupling-free on purpose.
 *
 *  visit / → see login → enter creds → submit → land on the dashboard.
 */
const EMAIL = process.env.E2E_EMAIL || 'admin@ever.co';
const PASSWORD = process.env.E2E_PASSWORD || 'admin';

test('super-admin can log in and reach the dashboard', async ({ page }) => {
	await page.goto('/');

	// Login screen renders
	await expect(page.locator('h2#title')).toBeVisible();

	// Enter credentials (selectors from the Cypress LoginPageObject)
	await page.locator('#input-email').fill(EMAIL);
	await page.locator('#input-password').fill(PASSWORD);
	await page.locator('button[type="submit"]').click();

	// Landed in the authenticated app — URL leaves /auth and the main layout shows.
	await expect(page).toHaveURL(/\/(pages|dashboard)/, { timeout: 60_000 });
});
