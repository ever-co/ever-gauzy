import { Component, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IPayment } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ga-invoice-paid',
	template: `
		<div class="progress-bar-container">
			<div class="progress-bar">
				<div class="paid-percent">
					{{ paidAmountPercentage }}%
					{{ 'INVOICES_PAGE.PAYMENTS.PAID' | translate }}
				</div>
				<span
					id="progress-bar-inner"
					class="progress-bar-inner"
					[style.width]="paidAmountPercentage + '%'"
				></span>
			</div>
		</div>
	`,
	styles: [
		'.progress-bar-inner {background-color: rgba(0, 214, 143, 1); position: absolute; height: 32px; width:100%; border-radius: 4px;}',
		'.progress-bar {background-color: rgba(126, 126, 143, 0.2); border-radius: 4px; position: relative; height: 32px}',
		'.paid-percent {color: #ffffff; z-index: 1; font-weight: bold;}'
	]
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
