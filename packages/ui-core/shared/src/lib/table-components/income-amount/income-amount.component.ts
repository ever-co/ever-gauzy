import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { InvoiceTotalValueComponent } from '../invoice-total-value/invoice-total-value.component';
import { CurrencyPositionPipe } from '../../pipes/currency-position.pipe';

@Component({
	selector: 'ga-income-amount',
	template: `
		<span
			>{{ value | currency : rowData?.currency | position : organization?.currencyPosition }}
			@if (rowData?.isBonus) {
				<nb-icon nbTooltip="{{ 'INCOME_PAGE.BONUS_TOOLTIP' | translate }}" icon="gift-outline"> </nb-icon>
			}
			@if (rowData?.splitExpense && !(rowData?.originalValue && rowData?.employeeCount)) {
				<nb-icon nbTooltip="{{ 'EXPENSES_PAGE.SPLIT_WILL_BE_TOOLTIP' | translate }}" icon="pricetags-outline">
				</nb-icon>
			}
			@if (rowData?.splitExpense && rowData?.originalValue && rowData?.employeeCount) {
				<nb-icon
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
			}
		</span>
	`,
	styles: [],
	standalone: true,
	imports: [CommonModule, TranslateModule, NbIconModule, NbTooltipModule, CurrencyPositionPipe]
})
export class IncomeExpenseAmountComponent extends InvoiceTotalValueComponent {}
