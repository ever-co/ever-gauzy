import { Component, Input } from '@angular/core';
import { IDocument } from '@gauzy/contracts';

/**
 * `Updated` cell — one truncating line plus the full timestamp in a tooltip.
 *
 * The column used to be a plain `type: 'text'` cell, so a locale timestamp
 * ("8/19/2026, 6:46:21 AM") wrapped onto two lines and set the height of every
 * row that carried one. The visible text is now pinned to a single line sized by
 * `--docs-updated-cell-width` (the table steps that token down per breakpoint),
 * clipped with an ellipsis, and the tooltip carries the long unambiguous form —
 * so nothing is lost to the truncation.
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
			/* A FIXED width, not a max-width: a table cell's min-content width is
			   the width of its own unwrapped text, so a max-width alone would let
			   the column grow to fit the whole timestamp and never truncate.
			   Pinning the box makes the column's contribution exactly this token
			   and hands the overflow to the ellipsis. */
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

	/**
	 * Formatting is memoized on the raw value: both getters are template
	 * bindings, so they re-run on every change-detection cycle of every visible
	 * row, and `Intl` formatting is the expensive half of that.
	 */
	private cache: { raw: unknown; display: string; tooltip: string } = { raw: {}, display: '', tooltip: '' };

	/** Short form — the row's own line. */
	get display(): string {
		return this.format().display;
	}

	/** Long form — what the tooltip restores of the truncated line. */
	get tooltip(): string {
		return this.format().tooltip;
	}

	private format(): { display: string; tooltip: string } {
		const raw = this.value ?? this.rowData?.updatedAt;
		if (raw === this.cache.raw) return this.cache;

		const date = raw ? new Date(raw as string) : null;
		// An unparseable timestamp renders as an empty cell rather than "Invalid Date".
		const valid = !!date && !Number.isNaN(date.getTime());
		this.cache = {
			raw,
			display: valid ? date.toLocaleString() : '',
			tooltip: valid ? date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' }) : ''
		};
		return this.cache;
	}
}
