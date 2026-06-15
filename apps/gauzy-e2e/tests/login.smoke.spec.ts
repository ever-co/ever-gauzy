import { test, expect } from '@playwright/test';

/**
 * Login smoke test — the proof-of-pattern for the Cypress → Playwright migration.
 *
 * Mirrors the legacy Cypress LoginTest (src/integration/LoginTest.ts):
 *  visit / → see login → enter creds → submit → land on the dashboard.
 *
 * Selectors reused verbatim from the Cypress page objects
 * (src/support/Base/pageobjects/LoginPageObject.ts) so they stay in lockstep
 * during the migration. Credentials default to the seeded super-admin.
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
