import { CategoryChipsComponent } from './category-chips.component';
import { TagChipsComponent } from './tag-chips.component';
import { IDocument, IDocumentCategory, ITag } from '@gauzy/contracts';

/**
 * Parity guard for the change-detection reference-stability discipline (same as
 * `FacetMultiselectComponent`). These chip cells render per table row on every browse-list change
 * detection; their `visible` getter used to `slice()` a fresh array each call, so `*ngFor` (without
 * `trackBy`) recreated the chip DOM every cycle. `visible` is now memoized on its source reference
 * and the `*ngFor` uses `trackById`, so unchanged rows never churn.
 */
describe('table chip cells — visible reference stability', () => {
	const category = (id: string, name = id): IDocumentCategory => ({ id, name } as IDocumentCategory);
	const tag = (id: string, name = id): ITag => ({ id, name } as ITag);

	describe('CategoryChipsComponent', () => {
		let component: CategoryChipsComponent;

		beforeEach(() => {
			component = new CategoryChipsComponent();
		});

		it('returns the SAME visible array across reads while the source is unchanged', () => {
			component.value = [category('a'), category('b'), category('c'), category('d')];
			const first = component.visible;

			expect(component.visible).toBe(first);
			expect(component.visible).toBe(first);
			expect(first.map((c) => c.id)).toEqual(['a', 'b', 'c']); // max 3
		});

		it('rebuilds only when the source array reference changes', () => {
			component.value = [category('a')];
			const first = component.visible;

			component.value = [category('a'), category('b')];
			expect(component.visible).not.toBe(first);
			expect(component.visible.map((c) => c.id)).toEqual(['a', 'b']);
		});

		it('falls back to rowData.categories and stays stable', () => {
			component.rowData = { categories: [category('x'), category('y')] } as IDocument;
			const first = component.visible;

			expect(component.visible).toBe(first);
			expect(first.map((c) => c.id)).toEqual(['x', 'y']);
		});

		it('tracks by category id', () => {
			expect(component.trackById(0, category('z'))).toBe('z');
		});
	});

	describe('TagChipsComponent', () => {
		let component: TagChipsComponent;

		beforeEach(() => {
			component = new TagChipsComponent();
		});

		it('returns the SAME visible array across reads while the source is unchanged', () => {
			component.value = [tag('a'), tag('b'), tag('c'), tag('d')];
			const first = component.visible;

			expect(component.visible).toBe(first);
			expect(first.map((t) => t.id)).toEqual(['a', 'b', 'c']);
		});

		it('rebuilds only when the source array reference changes', () => {
			component.value = [tag('a')];
			const first = component.visible;

			component.value = [tag('a'), tag('b')];
			expect(component.visible).not.toBe(first);
		});

		it('tracks by tag id', () => {
			expect(component.trackById(0, tag('z'))).toBe('z');
		});
	});
});
