import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { IDocumentFacetBucket } from '../../models/docs-api.model';

/**
 * Generic multi-select facet dropdown over `{ label, value, count }[]`, built on
 * ng-select.
 */
@Component({
	selector: 'gz-docs-facet-multiselect',
	template: `
		<ng-select
			[items]="options"
			bindLabel="label"
			bindValue="value"
			[trackByFn]="trackByValue"
			[multiple]="true"
			[closeOnSelect]="false"
			[searchable]="false"
			appendTo="body"
			[placeholder]="labelKey | translate"
			[ngModel]="selectedValues"
			(ngModelChange)="onSelectedChange($event)"
		>
			<ng-template ng-option-tmp let-option="item">
				<div class="docs-facet-option">
					<span>{{ option.label }}</span>
					<span class="docs-facet-count" *ngIf="option.count !== undefined"> ({{ option.count }}) </span>
				</div>
			</ng-template>
		</ng-select>
	`,
	styles: [
		`
			:host {
				display: block;
				width: 100%;
				min-width: 0;
			}

			/* =========================
			 * Main select container
			 * ========================= */

			::ng-deep .ng-select .ng-select-container {
				display: flex;
				align-items: center !important;
				min-height: 1.75rem;
			}

			/* =========================
			 * Value container
			 * ========================= */

			::ng-deep .ng-select .ng-value-container {
				display: flex;
				align-items: center !important;
				min-height: 1.75rem;
				max-height: 3.5rem;
				overflow-y: auto;
				overflow-x: hidden;
				padding-top: 0 !important;
				padding-bottom: 0 !important;
				font-size: 10px !important;
				line-height: 1 !important;
				scrollbar-width: thin;
			}

			/* =========================
			 * Selected values
			 * ========================= */

			::ng-deep .ng-select .ng-value {
				display: inline-flex;
				align-items: center;
				font-size: 10px !important;
				line-height: 1 !important;
			}

			::ng-deep .ng-select .ng-value-label {
				display: inline-flex;
				align-items: center;
				font-size: 10px !important;
				line-height: 1 !important;
			}

			/* =========================
			 * Placeholder
			 * ========================= */

			::ng-deep .ng-select .ng-placeholder {
				display: flex;
				align-items: center;
				height: 1.75rem;
				margin: 0 !important;
				padding: 0 !important;
				font-size: 10px !important;
				line-height: 1 !important;
			}

			/* =========================
			 * Search / input
			 * ========================= */

			::ng-deep .ng-select .ng-input {
				display: flex;
				align-items: center;
				height: 1.75rem;
				padding: 0 !important;
			}

			::ng-deep .ng-select .ng-input > input {
				height: 1.75rem !important;
				padding: 0 !important;
				font-size: 10px !important;
				line-height: 1 !important;
			}

			/* =========================
			 * Arrow and clear button
			 * ========================= */

			::ng-deep .ng-select .ng-arrow-wrapper,
			::ng-deep .ng-select .ng-clear-wrapper {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				height: 100%;
			}

			/* =========================
			 * Dropdown panel options
			 * ========================= */

			::ng-deep .ng-dropdown-panel .ng-option {
				display: flex;
				align-items: center;
				min-height: 1.75rem;
				padding-top: 0 !important;
				padding-bottom: 0 !important;
				font-size: 10px !important;
				line-height: 1.2 !important;
			}

			::ng-deep .ng-dropdown-panel .ng-option-label {
				display: flex;
				align-items: center;
				font-size: 10px !important;
				line-height: 1.2 !important;
			}

			/* =========================
			 * Custom option content
			 * ========================= */

			.docs-facet-option {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				width: 100%;
				font-size: 10px;
				line-height: 1.2;
			}

			.docs-facet-count {
				color: var(--docs-text-muted, var(--text-hint-color));
				font-size: 10px;
				font-variant-numeric: tabular-nums;
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

	/** Reference-stable mirror of `selected`. */
	public selectedValues: string[] = [];

	/** Content fingerprint of the last-built options. */
	private optionsSignature = '';

	/** Content fingerprint of selectedValues. */
	private selectedSignature = '';

	ngOnChanges(): void {
		const buckets = this.buckets ?? [];
		const selected = this.selected ?? [];

		const known = new Set(buckets.map((bucket) => bucket.value));

		const stale = selected.filter((value) => !known.has(value));

		// Resolved labels are part of the fingerprint so locale changes
		// correctly rebuild the options.
		const signature = JSON.stringify([
			buckets.map((bucket) => [bucket.value, this.resolveLabel(bucket.value, bucket.label), bucket.count]),
			stale.map((value) => [value, this.resolveLabel(value)])
		]);

		if (signature !== this.optionsSignature) {
			this.optionsSignature = signature;

			this.options = [
				...buckets.map((bucket) => ({
					value: bucket.value,
					label: this.resolveLabel(bucket.value, bucket.label),
					count: bucket.count
				})),

				// Keep stale selected values visible.
				...stale.map((value) => ({
					value,
					label: this.resolveLabel(value)
				}))
			];
		}

		const selectedSignature = JSON.stringify(selected);

		if (selectedSignature !== this.selectedSignature) {
			this.selectedSignature = selectedSignature;
			this.selectedValues = [...selected];
		}
	}

	/**
	 * Stable identity for ng-select items.
	 */
	trackByValue(option: { value: string }): string {
		return option.value;
	}

	onSelectedChange(values: string[]): void {
		const next = values ?? [];

		// Keep the local mirror synchronized before the parent/store
		// sends the updated values back.
		this.selectedSignature = JSON.stringify(next);
		this.selectedValues = next;

		this.selectionChange.emit(next);
	}

	private resolveLabel(value: string, label?: string): string {
		if (label) {
			return label;
		}

		return this.labelFor ? this.labelFor(value) : value;
	}
}
