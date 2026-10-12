/**
 * Server-resolved breadcrumb mapping (`00-product-spec.md` §6.9 R-TRE-01 +
 * `08-permissions-security.md` §3.2).
 */
import { ID } from '@gauzy/contracts';
import type { IDocumentPathSegment } from '../../services/documents.service';
import { toDocsBreadcrumb } from './docs-breadcrumb.util';

const ROOT = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const CHILD = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

/** No node is cached unless a test says so — the common case for a cold deep link. */
const noNames = () => undefined;

describe('toDocsBreadcrumb', () => {
	it('maps a readable chain root → self', () => {
		const segments: IDocumentPathSegment[] = [
			{ id: ROOT, name: 'Finance' },
			{ id: CHILD, name: 'Invoices' }
		];

		expect(toDocsBreadcrumb(segments, CHILD, noNames)).toEqual([
			{ id: ROOT, name: 'Finance', restricted: false },
			{ id: CHILD, name: 'Invoices', restricted: false }
		]);
	});

	it('keeps a redacted ancestor as a placeholder instead of dropping it', () => {
		// Dropping it would silently shorten the path and make the trail claim the
		// folder sits one level higher than it does.
		const segments: IDocumentPathSegment[] = [
			{ id: null, restricted: true },
			{ id: CHILD, name: 'Invoices' }
		];

		const crumbs = toDocsBreadcrumb(segments, CHILD, noNames);

		expect(crumbs).toHaveLength(2);
		expect(crumbs[0]).toEqual({ id: null, name: '', restricted: true });
	});

	it('treats a segment with no id as redacted even without the flag', () => {
		const crumbs = toDocsBreadcrumb([{ id: null, name: 'Finance' }], CHILD, noNames);

		expect(crumbs[0].restricted).toBe(true);
	});

	it('returns null (fall back) when the response is not an array', () => {
		expect(toDocsBreadcrumb(undefined, CHILD, noNames)).toBeNull();
		expect(toDocsBreadcrumb(null, CHILD, noNames)).toBeNull();
		expect(toDocsBreadcrumb({} as unknown as IDocumentPathSegment[], CHILD, noNames)).toBeNull();
	});

	it('returns an empty chain — NOT null — for a root-level folder', () => {
		// `[]` is a legitimate answer; treating it as a failure would send the caller to
		// the local walk, which produces a different trail for the same location.
		expect(toDocsBreadcrumb([], CHILD, noNames)).toEqual([]);
	});

	describe('ancestors-only responses', () => {
		it('appends the current folder from the node cache', () => {
			const segments: IDocumentPathSegment[] = [{ id: ROOT, name: 'Finance' }];

			const crumbs = toDocsBreadcrumb(segments, CHILD, (id) => (id === CHILD ? 'Invoices' : undefined));

			expect(crumbs).toEqual([
				{ id: ROOT, name: 'Finance', restricted: false },
				{ id: CHILD, name: 'Invoices' }
			]);
		});

		it('leaves the crumb off rather than rendering a blank one when the name is unknown', () => {
			const crumbs = toDocsBreadcrumb([{ id: ROOT, name: 'Finance' }], CHILD, noNames);

			expect(crumbs).toHaveLength(1);
		});

		it('does not double the last crumb when the chain already ends at the folder', () => {
			const nameOf = jest.fn(() => 'Invoices');

			const crumbs = toDocsBreadcrumb([{ id: CHILD, name: 'Invoices' }], CHILD, nameOf);

			expect(crumbs).toHaveLength(1);
			expect(nameOf).not.toHaveBeenCalled();
		});
	});
});
