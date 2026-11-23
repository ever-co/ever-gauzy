import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IPayment } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
    selector: 'ga-invoice-paid',
    // The "Paid" cell of the invoices / received-invoices grids. Two defects and a
    // density mismatch:
    //
    //   * the caption was painted UNDER the fill. It carried `z-index: 1` while
    //     `position: static`, where z-index has no effect, and the fill span was
    //     absolutely positioned — i.e. in the positioned paint layer, above every
    //     in-flow sibling. A fully-paid invoice showed a green bar and no text.
    //   * where the fill had not reached, the caption was hard-coded `#ffffff` on a
    //     pale grey track: invisible on the four light themes, which is exactly the
    //     0 %-paid case.
    //   * a 32px bar in a grid whose cells are 13px/20px on 6px padding made this
    //     one column set the row height for the whole table.
    //
    // The caption sits beside the meter as plain body text. The meter is a thin
    // fixed-width track, so every row's bar starts and ends at the same place
    // and the figures line up; its fill stops at 100 % while the caption keeps
    // the real figure (an overpaid invoice reads e.g. "317.6% Paid").
    template: `
		<div class="progress-bar-container">
			<div class="progress-bar">
				<span class="progress-bar-inner" [style.width]="barWidth + '%'"></span>
			</div>
			<span class="paid-percent">
				{{ paidAmountPercentage }}%
				{{ 'INVOICES_PAGE.PAYMENTS.PAID' | translate }}
			</span>
		</div>
	`,
    styles: [
        '.progress-bar-container {display: flex; align-items: center; gap: 0.5rem;}',
        '.progress-bar {background-color: var(--gauzy-sidebar-background-3, rgba(126, 126, 143, 0.15)); border-radius: 0.125rem; height: 0.25rem; flex: 0 0 3.5rem; overflow: hidden;}',
        '.progress-bar-inner {background-color: var(--color-success-default, rgba(0, 214, 143, 1)); display: block; height: 100%; border-radius: inherit;}',
        '.paid-percent {color: var(--gauzy-text-color-1, inherit); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap;}'
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InvoicePaidComponent extends TranslationBaseComponent implements OnInit {
	public paidAmountPercentage: number;
	public totalPaid = 0;

	/** The meter's fill, capped at a full bar. */
	get barWidth(): number {
		return Math.min(Math.max(this.paidAmountPercentage || 0, 0), 100);
	}

	@Input() rowData: any;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this._calculatePaid();
	}

	/**
	 * Calculates the total amount paid, determines the percentage of the total value that has been paid,
	 * and updates the bar width accordingly.
	 */
	private _calculatePaid(): void {
		this.totalPaid = this.rowData.payments.reduce((total: number, payment: IPayment) => total + +payment.amount, 0);

		// Ensure that total value is non-zero to avoid division by zero
		const totalValue = +this.rowData.totalValue || 1;

		this.paidAmountPercentage = +this.calculatePercentage(this.totalPaid, totalValue).toFixed(2);
	}

	/**
	 * Calculates the percentage based on the given values.
	 *
	 * @param numerator - The numerator for calculating the percentage.
	 * @param denominator - The denominator for calculating the percentage.
	 * @returns The calculated percentage.
	 */
	private calculatePercentage(numerator: number, denominator: number): number {
		return (numerator / denominator) * 100;
	}
}
