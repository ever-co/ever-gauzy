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
			<nb-icon
				*ngIf="
					rowData?.splitExpense &&
					!(rowData?.originalValue && rowData?.employeeCount)
				"
				nbTooltip="{{
					'EXPENSES_PAGE.SPLIT_WILL_BE_TOOLTIP' | translate
				}}"
				icon="pricetags-outline"
			>
			</nb-icon>
			<nb-icon
				*ngIf="
					rowData?.splitExpense &&
					rowData?.originalValue &&
					rowData?.employeeCount
				"
				nbTooltip="{{
					'POP_UPS.SPLIT_EXPENSE_WITH_INFO'
						| translate
							: {
									originalValue: rowData.originalValue,
									employeeCount: rowData.employeeCount
							  }
				}}"
				icon="pricetags-outline"
			>
			</nb-icon>
		</span>
	`,
	styles: []
})
export class IncomeExpenseAmountComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
