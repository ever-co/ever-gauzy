import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { from, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: income minus expenses for the selected employee.
 *
 * Rendered in the emphasized (`highlight`) variant, like the legacy page, and
 * flips from the success colour to the danger colour when it goes negative —
 * which is the one number on this dashboard nobody should have to read twice.
 *
 * Clicking it opens the profit history: incomes and expenses side by side, so
 * the figure can be traced back to the records that produced it.
 */
@Component({
	selector: 'ga-hr-profit-widget',
	templateUrl: './hr-profit-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrProfitWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Formatted profit. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().profit));

	/** Success while the employee is in the black, danger once they are not. */
	protected readonly color: Signal<string> = computed(() =>
		this.signedColor(this.totals().profit, HR_BLOCK_COLORS.INCOME, HR_BLOCK_COLORS.NEGATIVE)
	);

	/** Already formatted amounts interpolated into the "income − expenses" line. */
	protected readonly metaParams: Signal<Record<string, unknown>> = computed(() => {
		const totals = this.totals();
		return {
			totalAllIncome: this.formatAmount(totals.income),
			totalExpense: this.formatAmount(totals.expense)
		};
	});

	/**
	 * Opens the profit history dialog — incomes and expenses side by side.
	 *
	 * Overrides the base's single-history behaviour because profit is derived from
	 * two record sets, exactly as `HumanResourcesComponent.openProfitDialog()`
	 * does. Both requests and the dialog bundle are loaded in parallel, and any
	 * failure is reported rather than silently swallowing the click.
	 */
	public openProfitHistory(): void {
		const context = this.widgetContext();
		const employeeId = this.employeeId();
		if (!context || !employeeId || !this.dialogs) {
			return;
		}

		// Captured with the rest of the click-time scope. Reading `totals()`
		// after the await would pair the OLD employee's records with the NEW
		// employee's totals whenever the selection moves while the fetch is in
		// flight — a dialog that silently disagrees with itself.
		const totals = this.totals();
		const { startDate, endDate, organizationId, tenantId } = context;
		const history = (type: EmployeeStatisticsHistoryEnum) =>
			this.employeeStatistics.getEmployeeStatisticsHistory({
				employeeId,
				startDate,
				endDate,
				type,
				organizationId,
				tenantId
			});

		from(
			Promise.all([
				history(EmployeeStatisticsHistoryEnum.INCOME),
				history(EmployeeStatisticsHistoryEnum.EXPENSES),
				this.loadDeclaredComponent<unknown>(
					() => import('../../profit-history/profit-history.module'),
					() => import('../../profit-history/profit-history.component'),
					(module) => module.ProfitHistoryComponent
				)
			])
		)
			.pipe(
				take(1),
				catchError((error: unknown) => {
					this.reportActionError(error);
					return of(null);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((resolved) => {
				if (!resolved) {
					return;
				}
				const [incomes, expenses, component] = resolved;
				this.dialogs?.open(component, {
					context: {
						records: {
							incomes,
							expenses,
							incomeTotal: totals.income,
							expenseTotal: totals.expense,
							profit: totals.profit
						}
					}
				});
			});
	}
}
