import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	template: `
		<div class="progress-bar-container">
			<div class="progress-bar">
				<div class="paid-percent">
					{{ barWidth }}%
					{{ 'INVOICES_PAGE.PAYMENTS.PAID' | translate }}
				</div>
				<span
					id="progress-bar-inner"
					class="progress-bar-inner"
					[ngStyle]="{ width: barWidthString }"
				></span>
			</div>
		</div>
	`,
	styles: [
		'.progress-bar-inner {background-color: #2ce69b; display: block; position: relative; height: 20px; border-radius: 3px;}',
		'.progress-bar {background-color: #e0e0e0; border-radius: 3px;}',
		'.paid-percent {color: #000; position: absolute; z-index: 1; margin-left: 3%; font-weight: bold;}'
	]
})
export class InvoicePaidComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	rowData: any;
	barWidth: number;
	barWidthString: string;
	totalPaid = 0;

	ngOnInit() {
		this.calculatePaid();
	}

	calculatePaid() {
		for (const payment of this.rowData.payments) {
			this.totalPaid += +payment.amount;
		}

		this.barWidth = +(
			(this.totalPaid / +this.rowData.totalValue) *
			100
		).toFixed(2);

		if (this.barWidth > 100) {
			this.barWidth = 100;
		}

		this.barWidthString = `${this.barWidth}%`;
	}
}
