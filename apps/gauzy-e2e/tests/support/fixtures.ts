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
			setPage(page);
			// Smart-table filter rows are collapsed-by-default for users
			// (SmartTableFilterToggleDirective); several page objects type straight
			// into tr.angular2-smart-filters inputs, so specs opt into the
			// always-open behavior via the directive's stored preference.
			await page.addInitScript(() => {
				try {
					localStorage.setItem('gauzy.smartTable.filtersOpen', 'open');
				} catch {
					/* storage unavailable — the spec will surface it */
				}
			});
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
