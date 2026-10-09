import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: everything the selected employee cost, salary aside.
 *
 * Employee expenses + split expenses + recurring expenses. Reading it next to
 * {@link HrTotalExpensesWidgetComponent} gives the salary as the difference,
 * which is the comparison the legacy page's header makes.
 */
@Component({
	selector: 'ga-hr-expenses-without-salary-widget',
	templateUrl: './hr-expenses-without-salary-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrExpensesWithoutSalaryWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every expense figure. */
	protected readonly color = HR_BLOCK_COLORS.EXPENSE;

	/** History opened when the block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.EXPENSES_WITHOUT_SALARY;

	/** Formatted expenses excluding salary. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().expenseWithoutSalary));
}
