import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { IDocumentFacetBucket } from '../../models/docs-api.model';

/**
 * Generic multi-select facet dropdown over `{ label, value, count }[]`, built on
 * ng-select: it inherits the app-wide `ng-select-overrides()` geometry — whose
 * `min-height` is deliberately set WITHOUT `!important` so the filter bar's
 * compact pin wins, unlike the global `nb-select` floor — and `appendTo="body"`
 * keeps the panel clear of any ancestor overflow clipping. Selected values
 * missing from the loaded facets (deep links) are appended as stale-but-selected
 * options so the selection is never silently lost.
 */
@Component({
	selector: 'gz-docs-facet-multiselect',
	template: `
		<ng-select
			[items]="options"
			bindLabel="label"
			bindValue="value"
			[multiple]="true"
			[closeOnSelect]="false"
			[searchable]="false"
			appendTo="body"
			[placeholder]="labelKey | translate"
			[ngModel]="selectedValues"
			(ngModelChange)="onSelectedChange($event)"
		>
			<ng-template ng-option-tmp let-option="item">
				{{ option.label }}
				<span class="docs-facet-count" *ngIf="option.count !== undefined">({{ option.count }})</span>
			</ng-template>
		</ng-select>
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
	/** Reference-stable mirror of `selected` — see the `ngOnChanges` invariant. */
	public selectedValues: string[] = [];

	/** Content fingerprint of the last-built `options`, so a same-content rebuild is skipped. */
	private optionsSignature = '';
	/** Content fingerprint of `selectedValues` — same rule, for the model binding. */
	private selectedSignature = '';

	/**
	 * 🛑 `options` AND `selectedValues` MUST keep STABLE references across change-detection
	 * cycles whose content has not changed. The filter bar binds `[buckets]` to getters
	 * (`get kindBuckets()` …) that can return a NEW array of NEW objects, and
	 * `[selected]="value?.kind || []"` mints a fresh `[]` every cycle — so `ngOnChanges`
	 * fires on essentially every change detection. Rebuilding either unconditionally hands
	 * the select a new identity each cycle; with the previous `<nb-select>` that recreated
	 * every `<nb-option>`, whose `ngAfterViewInit` + content-query change retriggered change
	 * detection — a self-sustaining loop that pegged the main thread on the Documents hub
	 * (silent, zero HTTP, before the list even loaded). The fingerprints below rebuild only
	 * on real content change; the same rule protects the ng-select rebuild, whose
	 * `writeValue`/items diffing is cheaper but not free.
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
		if (signature !== this.optionsSignature) {
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

		const selectedSignature = JSON.stringify(selected);
		if (selectedSignature !== this.selectedSignature) {
			this.selectedSignature = selectedSignature;
			this.selectedValues = [...selected];
		}
	}

	/** Stable identity for ng-select's item tracking — unchanged options are never recreated. */
	trackByValue(option: { value: string }): string {
		return option.value;
	}

	onSelectedChange(values: string[]): void {
		const next = values ?? [];
		// Sync the local mirror first so the store round-trip (same content, new
		// array) short-circuits in `ngOnChanges` instead of re-writing the model.
		this.selectedSignature = JSON.stringify(next);
		this.selectedValues = next;
		this.selectionChange.emit(next);
	}

	private resolveLabel(value: string, label?: string): string {
		if (label) return label;
		return this.labelFor ? this.labelFor(value) : value;
	}
}
