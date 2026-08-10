import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { IDocumentFacetBucket } from '../../models/docs-api.model';

/**
 * Generic multi-select facet dropdown over `{ label, value, count }[]`.
 * Selected values missing from the loaded facets (deep links) are appended as
 * stale-but-selected options so the selection is never silently lost.
 */
@Component({
	selector: 'gz-docs-facet-multiselect',
	template: `
		<nb-select
			multiple
			size="small"
			[placeholder]="labelKey | translate"
			[selected]="selected"
			(selectedChange)="onSelectedChange($event)"
		>
			<nb-option *ngFor="let option of options; trackBy: trackByValue" [value]="option.value">
				{{ option.label }}
				<span class="docs-facet-count" *ngIf="option.count !== undefined">({{ option.count }})</span>
			</nb-option>
		</nb-select>
	`,
	styles: [
		`
			:host {
				display: inline-block;
				min-width: 9rem;
			}
			.docs-facet-count {
				color: var(--text-hint-color);
				margin-left: 0.25rem;
			}
		`
	],
	standalone: false
})
export class FacetMultiselectComponent implements OnChanges {
	@Input() buckets: IDocumentFacetBucket[] | null = [];
	@Input() selected: string[] = [];
	@Input() labelKey = '';
	/** Optional label resolver for enum facets (value → translated label). */
	@Input() labelFor?: (value: string) => string;
	@Output() selectionChange = new EventEmitter<string[]>();

	public options: { value: string; label: string; count?: number }[] = [];

	/** Content fingerprint of the last-built `options`, so a same-content rebuild is skipped. */
	private optionsSignature = '';

	/**
	 * 🛑 `options` MUST keep a STABLE reference across change-detection cycles whose content has
	 * not changed. The filter bar binds `[buckets]` to getters (`get kindBuckets()` …) that return
	 * a NEW array of NEW objects on every evaluation, and `[selected]="value?.kind || []"` mints a
	 * fresh `[]` every cycle — so `ngOnChanges` fires on essentially every change detection. If we
	 * rebuilt `options` unconditionally, `*ngFor` (even with `trackBy`) would receive a new array
	 * each cycle; combined with `<nb-select>` re-querying its `<nb-option>` ContentChildren, that
	 * recreated every option, whose `ngAfterViewInit` + the resulting content-query change
	 * retriggered change detection — a self-sustaining loop that pegged the main thread on the
	 * Documents hub (silent, zero HTTP, before the list even loaded). Rebuilding only when the
	 * fingerprint changes keeps the reference stable and breaks the cycle; `trackByValue` is the
	 * second line of defense for when the content genuinely does change.
	 */
	ngOnChanges(): void {
		const buckets = this.buckets ?? [];
		const selected = this.selected ?? [];
		const known = new Set(buckets.map((bucket) => bucket.value));
		const stale = selected.filter((value) => !known.has(value));

		const signature = JSON.stringify([
			buckets.map((bucket) => [bucket.value, bucket.label, bucket.count]),
			stale
		]);
		if (signature === this.optionsSignature) {
			return;
		}
		this.optionsSignature = signature;

		this.options = [
			...buckets.map((bucket) => ({
				value: bucket.value,
				label: this.resolveLabel(bucket.value, bucket.label),
				count: bucket.count
			})),
			// Keep stale selected values (deep links) visible as appended options.
			...stale.map((value) => ({ value, label: this.resolveLabel(value) }))
		];
	}

	/** Stable identity for `*ngFor` so unchanged options are never destroyed/recreated. */
	trackByValue(_index: number, option: { value: string }): string {
		return option.value;
	}

	onSelectedChange(values: string[]): void {
		this.selectionChange.emit(values ?? []);
	}

	private resolveLabel(value: string, label?: string): string {
		if (label) return label;
		return this.labelFor ? this.labelFor(value) : value;
	}
}
