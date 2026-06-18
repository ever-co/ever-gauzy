import { test as base } from '@playwright/test';
import * as fs from 'fs';
import { setPage } from './page-context';

/**
 * Shared test fixture for the migrated Playwright specs.
 *
 * Auto-binds the test's `page` into the module-scoped page-context so the ported
 * page-object + util layer (which reference getPage()) work without threading
 * `page` through every call. Import { test, expect } from this module in specs.
 */
export const test = base.extend<{ _autoPage: void }>({
	_autoPage: [
		async ({ page }, use) => {
			// Robust SPA navigation. goto() to a URL differing only in the hash fragment can be a
			// same-document no-op, so the Angular hash-router never re-renders: we stay on the previous
			// screen and the next generic "+ Add" click re-opens the PREVIOUS page's dialog (the root
			// cause of the "wrong dialog is open" cluster after addTag/addProject setup). After goto(),
			// if the hash didn't actually land on the target, force it so the router reacts, then settle.
			// This branch ONLY runs on a genuine no-op — when goto() works (every passing spec), it is a
			// complete no-op, so it cannot regress a passing spec.
			const realGoto = page.goto.bind(page);
			(page as { goto: (url: string, opts?: unknown) => Promise<unknown> }).goto = async (url, opts) => {
				const res = await realGoto(url, opts as Parameters<typeof realGoto>[1]);
				if (typeof url === 'string' && url.includes('#')) {
					const hash = url.slice(url.indexOf('#'));
					const onTarget = await page.evaluate((h) => {
						if (location.hash === h) return true;
						location.hash = h;
						return false;
					}, hash);
					if (!onTarget) await page.waitForTimeout(350);
				}
				return res;
			};
			setPage(page);
			await use();
		},
		{ auto: true }
	]
});

/**
 * On failure, optionally dump the full rendered HTML next to Playwright's error-context.md
 * (gated behind E2E_DUMP_HTML=1 to keep CI artifacts lean). Playwright's default error context
 * is an ARIA snapshot (roles/text only) — it omits the CSS classes, placeholders and
 * formcontrolnames the page-object selectors rely on. Capturing page.content() at the failure
 * point lets stale selectors be re-grounded in a single pass instead of one-broken-selector-per
 * rerun. Set E2E_DUMP_HTML=1 locally when triaging selectors.
 */
test.afterEach(async ({ page }, testInfo) => {
	if (process.env.E2E_DUMP_HTML && testInfo.status !== testInfo.expectedStatus) {
		try {
			fs.writeFileSync(testInfo.outputPath('page.html'), await page.content());
		} catch {
			/* page may already be closed — best-effort only */
		}
	}
});

export { expect } from '@playwright/test';
