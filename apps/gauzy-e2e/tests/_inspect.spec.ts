import { test } from '@playwright/test';

/**
 * Reusable triage helper for selector fixing (NOT part of the suite — name starts with _ but
 * playwright still picks it up; it is harmless/read-only and removed before final commit).
 *
 * Usage: INSPECT_URL='http://localhost:4200/#/pages/...' npx playwright test _inspect --reporter=line
 * Optionally INSPECT_CLICK='<css>' to click something first (e.g. open a dialog) before dumping.
 * Prints `INSPECT=<json>` with buttons / nb-actions / ng-selects / inputs / headers and their
 * stable attributes (text, class, id, placeholder, icon) so you can choose a current selector.
 */
test('inspect', async ({ page }) => {
	await page.goto('/');
	await page.locator('#input-email').fill('admin@ever.co');
	await page.locator('#input-password').fill('admin');
	await page.locator('button[type="submit"]').click();
	await page.waitForURL(/\/(pages|dashboard)/, { timeout: 60_000 });
	const target = process.env.INSPECT_URL;
	if (target) {
		await page.goto(target);
		await page.waitForTimeout(5000);
	}
	const click = process.env.INSPECT_CLICK;
	if (click) {
		try {
			await page.locator(click).first().click({ timeout: 8000 });
			await page.waitForTimeout(2500);
		} catch (e) {
			console.log('INSPECT_CLICK failed: ' + (e as Error).message);
		}
	}
	const info = await page.evaluate(() => {
		const clip = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
		const pick = (sel: string, n = 40) =>
			Array.from(document.querySelectorAll(sel))
				.slice(0, n)
				.map((el) => ({
					tag: el.tagName.toLowerCase(),
					text: clip(el.textContent),
					cls: clip(el.getAttribute('class')),
					id: el.id || undefined,
					ph: el.getAttribute('placeholder') || undefined,
					icon: el.getAttribute('icon') || el.getAttribute('nbtooltip') || undefined,
					status: el.getAttribute('status') || undefined
				}));
		return {
			url: location.href,
			buttons: pick('button'),
			nbActions: pick('nb-action', 20),
			selects: pick('ng-select, nb-select', 20),
			inputs: pick('input, textarea', 30),
			headers: pick('h1, h2, h3, h4, h5, nb-card-header', 20)
		};
	});
	console.log('INSPECT=' + JSON.stringify(info));
});
