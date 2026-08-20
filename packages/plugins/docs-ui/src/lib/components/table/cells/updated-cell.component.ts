import { Component, Input } from '@angular/core';
import { IDocument } from '@gauzy/contracts';

/**
 * `Updated` cell — one truncating line plus the full timestamp in a tooltip.
 */
@Component({
	selector: 'gz-docs-updated-cell',
	template: `
		<span class="docs-updated" *ngIf="display" [nbTooltip]="tooltip" nbTooltipPlacement="top">{{ display }}</span>
	`,
	styles: [
		`
			:host {
				display: block;
				min-width: 0;
			}
			.docs-updated {
				display: block;
				width: var(--docs-updated-cell-width, 9.5rem);
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-variant-numeric: tabular-nums;
				color: var(--docs-text-muted, var(--text-hint-color));
				cursor: default;
			}
		`
	],
	standalone: false
})
export class UpdatedCellComponent {
	@Input() rowData: IDocument;
	@Input() value: string | Date;

	/** Formatting is memoized on the raw value: both getters are template bindings. */
	private cache: { raw: unknown; display: string; tooltip: string } = { raw: {}, display: '', tooltip: '' };

	/** Short form, for the row itself. */
	get display(): string {
		return this.format().display;
	}

	/** Long form, for the tooltip. */
	get tooltip(): string {
		return this.format().tooltip;
	}

	private format(): { display: string; tooltip: string } {
		const raw = this.value ?? this.rowData?.updatedAt;
		if (raw === this.cache.raw) return this.cache;

		const date = raw ? new Date(raw as string) : null;
		const valid = !!date && !Number.isNaN(date.getTime());
		this.cache = {
			raw,
			display: valid ? date.toLocaleString() : '',
			tooltip: valid ? date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' }) : ''
		};
		return this.cache;
	}
}
