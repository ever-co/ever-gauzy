import { FacetMultiselectComponent } from './facet-multiselect.component';
import { IDocumentFacetBucket } from '../../models/docs-api.model';

/**
 * 🛑 Regression guard for the Documents-hub main-thread wedge.
 *
 * The filter bar binds `[buckets]` to getters and `[selected]="value?.x || []"`, both of which
 * yield a NEW array identity on every change-detection cycle. `FacetMultiselectComponent` used to
 * rebuild `options` (new array + new objects) on every resulting `ngOnChanges`, and its
 * `*ngFor` had no `trackBy` — so `<nb-select>` recreated every `<nb-option>` each cycle, whose
 * `ngAfterViewInit` + the content-query change retriggered change detection. That self-sustaining
 * loop pegged the main thread the moment the hub rendered (silent, zero HTTP).
 *
 * The load-bearing invariant is: **when the bucket/selection CONTENT is unchanged, `options` keeps
 * the same array reference across `ngOnChanges` calls** — even when the inputs are new arrays.
 */
describe('FacetMultiselectComponent — option reference stability', () => {
	const bucket = (value: string, count?: number, label?: string): IDocumentFacetBucket =>
		({ value, count, label } as IDocumentFacetBucket);

	let component: FacetMultiselectComponent;

	beforeEach(() => {
		component = new FacetMultiselectComponent();
	});

	/** Feed inputs the way the template does: a brand-new array identity every cycle. */
	const applyInputs = (values: string[], selected: string[] = []): void => {
		component.buckets = values.map((v) => bucket(v, 1));
		component.selected = [...selected];
		component.ngOnChanges();
	};

	it('keeps the SAME options reference when the content has not changed across cycles', () => {
		applyInputs(['FOLDER', 'PAGE', 'FILE']);
		const first = component.options;

		// Three more cycles with fresh input identities but identical content.
		applyInputs(['FOLDER', 'PAGE', 'FILE']);
		applyInputs(['FOLDER', 'PAGE', 'FILE']);
		applyInputs(['FOLDER', 'PAGE', 'FILE']);

		expect(component.options).toBe(first);
	});

	it('rebuilds options (new reference) only when the content actually changes', () => {
		applyInputs(['FOLDER', 'PAGE']);
		const first = component.options;

		applyInputs(['FOLDER', 'PAGE', 'FILE']); // a real change
		const second = component.options;

		expect(second).not.toBe(first);
		expect(second.map((o) => o.value)).toEqual(['FOLDER', 'PAGE', 'FILE']);
	});

	it('treats a changed count as a content change (facet counts arriving from the API)', () => {
		component.buckets = [bucket('READY', undefined)];
		component.selected = [];
		component.ngOnChanges();
		const before = component.options;

		component.buckets = [bucket('READY', 12)];
		component.ngOnChanges();

		expect(component.options).not.toBe(before);
		expect(component.options[0].count).toBe(12);
	});

	it('appends stale selected values as options and stays stable while they persist', () => {
		applyInputs(['FOLDER'], ['ARCHIVED_KIND_NOT_IN_BUCKETS']);
		const first = component.options;

		expect(first.map((o) => o.value)).toEqual(['FOLDER', 'ARCHIVED_KIND_NOT_IN_BUCKETS']);

		applyInputs(['FOLDER'], ['ARCHIVED_KIND_NOT_IN_BUCKETS']);
		expect(component.options).toBe(first);
	});

	it('exposes a value-based trackBy so unchanged options are never recreated', () => {
		expect(component.trackByValue({ value: 'FILE' })).toBe('FILE');
	});

	it('keeps the SAME selectedValues reference while the selection content is unchanged', () => {
		applyInputs(['FOLDER', 'PAGE'], ['FOLDER']);
		const first = component.selectedValues;

		applyInputs(['FOLDER', 'PAGE'], ['FOLDER']);
		applyInputs(['FOLDER', 'PAGE'], ['FOLDER']);

		expect(component.selectedValues).toBe(first);
		expect(first).toEqual(['FOLDER']);
	});

	it('syncs selectedValues on a user change without waiting for the store round-trip', () => {
		applyInputs(['FOLDER', 'PAGE'], []);
		component.onSelectedChange(['PAGE']);
		const emitted = component.selectedValues;

		// The store echoes the same content back as a new array — no rebuild.
		applyInputs(['FOLDER', 'PAGE'], ['PAGE']);

		expect(component.selectedValues).toBe(emitted);
	});
});
