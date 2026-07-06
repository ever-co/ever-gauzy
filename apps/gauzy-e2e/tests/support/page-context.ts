import type { Page } from '@playwright/test';

/**
 * Module-scoped current Page, set per-test by a Before hook / fixture.
 *
 * This mirrors how the Cypress suite relied on the global `cy`, so the ported
 * util layer and page objects keep their original signatures (no need to thread
 * `page` through every call) during the Cypress → Playwright migration.
 */
let currentPage: Page | undefined;

export const setPage = (page: Page): void => {
	currentPage = page;
};

export const getPage = (): Page => {
	if (!currentPage) {
		throw new Error('Playwright page not set — call setPage(page) in a Before hook / fixture before using the util layer.');
	}
	return currentPage;
};
