import { Component, Input, OnInit } from '@angular/core';
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
    // The caption now sits beside the meter, so it is plain body text on the card,
    // and the bar is a 0.5rem meter on the shared small radius.
    template: `
		<div class="progress-bar-container">
			<div class="progress-bar">
				<span class="progress-bar-inner" [style.width]="paidAmountPercentage + '%'"></span>
			</div>
			<span class="paid-percent">
				{{ paidAmountPercentage }}%
				{{ 'INVOICES_PAGE.PAYMENTS.PAID' | translate }}
			</span>
		</div>
	`,
    styles: [
        '.progress-bar-container {display: flex; align-items: center; gap: 0.5rem;}',
        '.progress-bar {background-color: var(--gauzy-sidebar-background-3, rgba(126, 126, 143, 0.1)); border-radius: var(--gauzy-radius-sm, 0.375rem); position: relative; height: 0.5rem; flex: 1 1 auto; min-width: 3rem; overflow: hidden;}',
        '.progress-bar-inner {background-color: var(--color-success-default, rgba(0, 214, 143, 1)); display: block; height: 100%; border-radius: inherit;}',
        '.paid-percent {color: var(--gauzy-text-color-1); font-weight: 600; white-space: nowrap;}'
    ],
    standalone: false
})
export class InvoicePaidComponent extends TranslationBaseComponent implements OnInit {
	public paidAmountPercentage: number;
	public totalPaid = 0;

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
