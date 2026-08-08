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
			<nb-option *ngFor="let option of options" [value]="option.value">
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

	ngOnChanges(): void {
		const buckets = this.buckets ?? [];
		const known = new Set(buckets.map((bucket) => bucket.value));
		this.options = buckets.map((bucket) => ({
			value: bucket.value,
			label: this.resolveLabel(bucket.value, bucket.label),
			count: bucket.count
		}));
		// Keep stale selected values visible as appended options.
		for (const value of this.selected ?? []) {
			if (!known.has(value)) {
				this.options.push({ value, label: this.resolveLabel(value) });
			}
		}
	}

	onSelectedChange(values: string[]): void {
		this.selectionChange.emit(values ?? []);
	}

	private resolveLabel(value: string, label?: string): string {
		if (label) return label;
		return this.labelFor ? this.labelFor(value) : value;
	}
}
