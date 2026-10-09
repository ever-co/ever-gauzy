import { ChangeDetectorRef, Directive, HostBinding, OnDestroy, OnInit } from '@angular/core';

/**
 * How long a freshly mounted grid is assumed to still be fetching.
 *
 * Kept in step with `NO_DATA_SETTLE_DELAY_MS` so a page whose two layouts (table
 * / card grid) settle at different moments does not flip between a skeleton and
 * an empty state.
 */
export const SMART_TABLE_SETTLE_DELAY_MS = 700;

/**
 * Marks every `angular2-smart-table` as "still settling" for the first moments
 * of its life.
 *
 * The library renders `<tr><td colspan="n">{{ noDataMessage }}</td></tr>` the
 * instant the grid holds zero rows, which is the state every list page is in
 * between mounting and its first response — so the very first frame the user
 * sees says "No Data". This directive puts a class on the host for that window
 * and the global `_gauzy-skeleton` rules repaint that one cell as a shimmer.
 *
 * It has NO inputs on purpose. It is attached by element selector to every
 * smart table in scope of `SmartDataViewLayoutModule`, so pages get the fix
 * without touching their templates; pages that own a real `loading` flag can be
 * precise about long requests by binding `[class.ga-table-loading]="loading"`,
 * which is a native class binding and therefore cannot break a template that
 * does not have this module in scope.
 */
@Directive({
	selector: 'angular2-smart-table',
	standalone: false
})
export class SmartTableSettlingDirective implements OnInit, OnDestroy {
	@HostBinding('class.ga-table-settling') settling: boolean = true;

	private settleTimer: ReturnType<typeof setTimeout>;

	constructor(private readonly cdr: ChangeDetectorRef) {}

	ngOnInit(): void {
		this.settleTimer = setTimeout(() => {
			this.settling = false;
			this.settleTimer = undefined;
			// Host bindings are evaluated with the declaring view; a bare timer
			// callback would not mark an OnPush ancestor dirty.
			this.cdr.markForCheck();
		}, SMART_TABLE_SETTLE_DELAY_MS);
	}

	ngOnDestroy(): void {
		if (this.settleTimer) {
			clearTimeout(this.settleTimer);
			this.settleTimer = undefined;
		}
	}
}
