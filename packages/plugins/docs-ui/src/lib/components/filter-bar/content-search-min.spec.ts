/**
 * `@gauzy/ui-core/i18n` is a barrel over the whole app i18n module; the filter bar only
 * needs `TranslationBaseComponent` to exist so the class can be constructed directly (no
 * `TestBed`, no Angular module graph).
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import { DOCS_CONTENT_SEARCH_MIN_CHARS } from '../../docs.constants';
import { DOCUMENT_CONTENT_SEARCH_MIN_CHARS, toDocumentsQueryParams } from '../../models/docs-api.model';
import { DocsFilterBarComponent } from './docs-filter-bar.component';

/**
 * The content-search minimum is a **cross-package contract** with
 * `packages/plugins/docs/src/lib/services/content-search.guard.ts`: the server answers 400
 * `DOCS_QUERY_TOO_SHORT` below it, so the gate that enables the Content toggle, the tooltip
 * that tells the user how many characters to type, and the request builder that decides
 * whether `searchIn=content` may go on the wire must all quote the SAME number.
 *
 * They did not. `DOCS_CONTENT_SEARCH_MIN_CHARS` carried an independent `2` while the server
 * (and `01-ux-spec.md` §5) required 3, so at exactly two characters the UI enabled Content
 * mode, promised content results in its tooltip — and `toDocumentsQueryParams()` quietly
 * downgraded the request to a name search. These tests pin the number on the client side.
 */
describe('content-search minimum — client/server contract', () => {
	const scope = {
		organizationId: 'e4a3b0a0-1111-4111-8111-111111111111',
		tenantId: 'e4a3b0a0-2222-4222-8222-222222222222'
	};
	const MIN = DOCUMENT_CONTENT_SEARCH_MIN_CHARS;

	it('is 3 — the minimum `DocumentService.buildFilters()` enforces (`01-ux-spec.md` §5)', () => {
		expect(DOCUMENT_CONTENT_SEARCH_MIN_CHARS).toBe(3);
	});

	it('has exactly one definition — the filter-bar constant re-exports the API-model one', () => {
		expect(DOCS_CONTENT_SEARCH_MIN_CHARS).toBe(DOCUMENT_CONTENT_SEARCH_MIN_CHARS);
	});

	describe('the filter-bar gate', () => {
		const filterBar = () => new DocsFilterBarComponent({} as never);

		it('reads the shared constant rather than a local literal', () => {
			expect(filterBar().contentSearchMinChars).toBe(MIN);
		});

		it('keeps the Content toggle disabled one character below the minimum', () => {
			const component = filterBar();
			component.value = { q: 'ab' } as never;

			expect('ab'.length).toBe(MIN - 1);
			expect(component.contentSearchDisabled).toBe(true);
		});

		it('enables the Content toggle at exactly the minimum — where the server accepts it', () => {
			const component = filterBar();
			component.value = { q: 'abc' } as never;

			expect('abc'.length).toBe(MIN);
			expect(component.contentSearchDisabled).toBe(false);
		});
	});

	describe('the request builder', () => {
		it('never sends a content search the gate would not have enabled', () => {
			expect(toDocumentsQueryParams({ ...scope, q: 'ab', searchIn: 'content' }).searchIn).toBe('name');
			expect(toDocumentsQueryParams({ ...scope, q: 'abc', searchIn: 'content' }).searchIn).toBe('content');
		});
	});

	describe('the tooltip', () => {
		const en = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'i18n', 'en.json'), 'utf8'));

		it('interpolates the minimum instead of hard-coding a number that can go stale', () => {
			const hint: string = en.FILTERS.SEARCH_CONTENT_DISABLED;

			expect(hint).toContain('{{ min }}');
			expect(hint).not.toMatch(/\d/);
		});
	});
});
