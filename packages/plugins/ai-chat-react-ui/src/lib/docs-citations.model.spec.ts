import { citationLabel, selectCitations, type IDocsCitation } from './docs-citations.model';

/**
 * Pure-logic coverage for the Documents citation chips: the label format the spec asks for
 * (`{name} · {heading} · p.{page}`) and the selection rules that keep the row readable.
 *
 * Rendering is deliberately not exercised — this package has no React test renderer, and the
 * two functions below are where every behaviour that can be wrong actually lives.
 */
describe('DocsCitationChips', () => {
	const citation = (overrides: Partial<IDocsCitation> = {}): IDocsCitation => ({
		documentId: 'doc-1',
		name: 'Employee Handbook',
		url: '/pages/documents?id=doc-1',
		...overrides
	});

	describe('citationLabel', () => {
		it('joins name, heading and page with the spec separator', () => {
			expect(citationLabel(citation({ heading: 'Expenses', page: 4 }))).toBe('Employee Handbook · Expenses · p.4');
		});

		it('omits the segments a hit has no locator for', () => {
			expect(citationLabel(citation())).toBe('Employee Handbook');
		});

		it('renders a sheet locator for spreadsheet hits', () => {
			expect(citationLabel(citation({ sheet: 'Q3' }))).toBe('Employee Handbook · Q3');
		});

		it('never leaves a blank chip when the hit carried no document name', () => {
			expect(citationLabel(citation({ name: '   ' }))).toBe('Untitled document');
		});

		it('drops a nonsensical page number rather than printing "p.0"', () => {
			expect(citationLabel(citation({ page: 0 }))).toBe('Employee Handbook');
		});
	});

	describe('selectCitations', () => {
		it('collapses hits that would render as the same chip, keeping the first (strongest)', () => {
			const selected = selectCitations([
				citation({ heading: 'Expenses', page: 4, chunkIndex: 3, score: 0.9 }),
				citation({ heading: 'Expenses', page: 4, chunkIndex: 4, score: 0.5 }),
				citation({ heading: 'Travel', page: 7, chunkIndex: 9, score: 0.4 })
			]);

			expect(selected.map((entry) => entry.chunkIndex)).toEqual([3, 9]);
		});

		it('keeps the same document when the locator differs', () => {
			const selected = selectCitations([citation({ page: 1 }), citation({ page: 2 })]);

			expect(selected).toHaveLength(2);
		});

		it('drops entries with no id or no url — a chip that cannot navigate is noise', () => {
			const selected = selectCitations([
				{ documentId: '', url: '/pages/documents?id=x' } as IDocsCitation,
				{ documentId: 'doc-2', url: '' } as IDocsCitation,
				citation()
			]);

			expect(selected).toEqual([citation()]);
		});

		it('caps the row at eight chips', () => {
			const many = Array.from({ length: 20 }, (_value, index) =>
				citation({ documentId: `doc-${index}`, url: `/pages/documents?id=doc-${index}` })
			);

			expect(selectCitations(many)).toHaveLength(8);
		});

		it('tolerates a missing citations array', () => {
			expect(selectCitations(undefined as unknown as IDocsCitation[])).toEqual([]);
		});
	});
});
