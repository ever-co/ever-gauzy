import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: the full cost of the selected employee.
 *
 * Employee expenses + split expenses + recurring expenses + salary — the
 * denominator of the Profit block.
 */
@Component({
	selector: 'ga-hr-total-expenses-widget',
	templateUrl: './hr-total-expenses-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrTotalExpensesWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every expense figure. */
	protected readonly color = HR_BLOCK_COLORS.EXPENSE;

	/** History opened when the block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.EXPENSES;

	/** Formatted total expenses. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().expense));
}
