import { DOCS_CONTENT_SEARCH_MIN_CHARS, DOCS_QUERY_TOO_SHORT } from '../docs.constants';
import { assertContentSearchQueryLength } from './content-search.guard';

/**
 * The content-search minimum is a **cross-package contract**: the server rejects a shorter
 * query, and `@gauzy/plugin-docs-ui` gates its Content toggle + tooltip on the same number
 * (`DOCUMENT_CONTENT_SEARCH_MIN_CHARS`). They disagreed once — the client advertised 2 while
 * this guard demanded 3, so a 2-character content search silently fell back to a name search
 * (and any client that did send it got a 400). Pinning the number here makes a one-sided
 * change fail the suite instead of the user.
 */
describe('content-search minimum', () => {
	it('is 3 characters, as `01-ux-spec.md` §5 specifies', () => {
		expect(DOCS_CONTENT_SEARCH_MIN_CHARS).toBe(3);
	});

	it('rejects a query one character below the minimum with DOCS_QUERY_TOO_SHORT', () => {
		expect.assertions(3);
		try {
			assertContentSearchQueryLength('ab');
		} catch (error: any) {
			expect(error.getStatus()).toBe(400);
			expect(error.getResponse().code).toBe(DOCS_QUERY_TOO_SHORT);
			expect(error.getResponse().message).toContain('at least 3');
		}
	});

	it('rejects an empty or missing query rather than scanning every row', () => {
		expect(() => assertContentSearchQueryLength('')).toThrow();
		expect(() => assertContentSearchQueryLength(undefined as unknown as string)).toThrow();
	});

	it('accepts a query at exactly the minimum', () => {
		expect(() => assertContentSearchQueryLength('abc')).not.toThrow();
	});

	it('accepts anything longer', () => {
		expect(() => assertContentSearchQueryLength('invoice')).not.toThrow();
	});
});
