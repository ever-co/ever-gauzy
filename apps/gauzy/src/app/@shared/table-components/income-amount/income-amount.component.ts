import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-income-amount',
	template: `
		<span
			>{{ rowData.currency }} {{ value }}
			<nb-icon
				*ngIf="rowData?.isBonus"
				nbTooltip="{{ 'INCOME_PAGE.BONUS_TOOLTIP' | translate }}"
				icon="gift-outline"
			>
			</nb-icon>
		</span>
	`,
	styles: []
})
export class IncomeAmountComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
