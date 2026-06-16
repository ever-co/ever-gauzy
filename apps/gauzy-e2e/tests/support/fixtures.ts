import { test as base } from '@playwright/test';
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
			await use();
		},
		{ auto: true }
	]
});

export { expect } from '@playwright/test';
