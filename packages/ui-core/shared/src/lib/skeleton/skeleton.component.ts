import { Component, Input } from '@angular/core';

export type SkeletonVariant = 'lines' | 'table' | 'cards';

/** Frozen index arrays — the template iterates them, so they must be stable. */
const SINGLE_BAR: number[] = [0];
const CARD_BARS: number[] = [0, 1, 2];

/**
 * A dependency-free, theme-token-only loading placeholder.
 *
 * It exists so a list surface can say "still loading" instead of the far more
 * alarming "No Data" while its request is still in flight. Three shapes:
 *
 *  - `lines`  a stack of bars, for a generic panel
 *  - `table`  a stack of rows, each split into `columns` bars
 *  - `cards`  a responsive grid of card-shaped blocks, matching `ga-card-grid`
 *
 * The shimmer is pure CSS (no new dependency) and honours
 * `prefers-reduced-motion`.
 */
@Component({
	selector: 'ngx-skeleton',
	templateUrl: './skeleton.component.html',
	styleUrls: ['./skeleton.component.scss'],
	standalone: false
})
export class SkeletonComponent {
	/** Shape of the placeholder. */
	@Input() variant: SkeletonVariant = 'lines';

	/** How many rows / cards to draw. */
	@Input() set rows(value: number) {
		this._rows = this.clamp(value, 1, 24);
	}
	get rows(): number {
		return this._rows;
	}
	private _rows: number = 5;

	/** How many bars per row (`table` variant only). */
	@Input() set columns(value: number) {
		this._columns = this.clamp(value, 1, 12);
	}
	get columns(): number {
		return this._columns;
	}
	private _columns: number = 4;

	/**
	 * `@for` needs a real iterable; these are index arrays rebuilt only when the
	 * corresponding count changes, so the template never allocates per CD cycle.
	 */
	get rowIndexes(): number[] {
		if (this._rowIndexes.length !== this._rows) {
			this._rowIndexes = Array.from({ length: this._rows }, (_, index) => index);
		}
		return this._rowIndexes;
	}
	private _rowIndexes: number[] = [];

	get columnIndexes(): number[] {
		if (this._columnIndexes.length !== this._columns) {
			this._columnIndexes = Array.from({ length: this._columns }, (_, index) => index);
		}
		return this._columnIndexes;
	}
	private _columnIndexes: number[] = [];

	/**
	 * Bars inside one row: as many as there are columns for a table, a small
	 * fixed stack for a card (title + two content lines), a single bar otherwise.
	 */
	get barIndexes(): number[] {
		if (this.variant === 'table') {
			return this.columnIndexes;
		}
		return this.variant === 'cards' ? CARD_BARS : SINGLE_BAR;
	}

	/**
	 * Coerce a possibly string/NaN template input into a sane count.
	 *
	 * @param value raw input value
	 * @param min lower bound
	 * @param max upper bound
	 * @returns an integer within [min, max]
	 */
	private clamp(value: number, min: number, max: number): number {
		const parsed = Math.floor(Number(value));
		if (!Number.isFinite(parsed)) {
			return min;
		}
		return Math.min(Math.max(parsed, min), max);
	}
}
