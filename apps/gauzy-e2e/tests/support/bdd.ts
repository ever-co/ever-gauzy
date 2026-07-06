import { test as base, createBdd } from 'playwright-bdd';
import { setPage } from './page-context';

/**
 * BDD test fixture for the restored Gherkin layer (playwright-bdd).
 *
 * The whole migrated suite drives the app through a module-scoped `page` (see page-context.ts) so the
 * ported page-object + util layer can call getPage() without threading `page` everywhere. Plain specs bind
 * that via tests/support/fixtures.ts; this file does the same for BDD step definitions, so the same
 * already-migrated + hardened page objects back both the plain specs and the .feature scenarios.
 *
 * Step definition files import { Given, When, Then } from here; .feature files live in tests/bdd/features
 * and the generated Playwright specs are produced by `bddgen` (see playwright.config.ts defineBddConfig).
 */
export const test = base.extend<{ _bindPage: void }>({
	_bindPage: [
		async ({ page }, use) => {
			setPage(page);
			await use();
		},
		{ auto: true }
	]
});

export const { Given, When, Then, Before, After } = createBdd(test);
