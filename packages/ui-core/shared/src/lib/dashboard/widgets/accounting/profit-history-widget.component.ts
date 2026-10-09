import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	EmployeeStatisticsHistoryEnum,
	ID,
	IEmployeeStatisticsHistory,
	IMonthAggregatedEmployeeStatistics
} from '@gauzy/contracts';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { ProfitHistoryModule } from '../../profit-history/profit-history.module';
// The totals come from `/employee-statistics/months`, the same payload every HR
// info block reads — through the same cache, so a canvas holding this widget and
// the HR blocks still issues one request for it.
import { EmployeeMonthStatisticsCacheService } from '../charts/employee-month-statistics-cache.service';
import { sumHrStatistics } from '../hr/hr-statistics.utils';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';
import { BaseEmployeeHistoryWidgetComponent } from './base-employee-history-widget.component';

/** Exactly the object `ProfitHistoryComponent` renders. */
export interface IProfitHistoryRecords {
	incomes: IEmployeeStatisticsHistory[];
	expenses: IEmployeeStatisticsHistory[];
	incomeTotal: number;
	expenseTotal: number;
	profit: number;
}

/**
 * The Human Resources profit report, inline on a canvas.
 *
 * `ProfitHistoryComponent` only ever existed as a modal: the HR page fetched two
 * histories, took the totals it had already computed for its own blocks, and
 * handed the lot to `NbDialogService`. This widget reuses that exact component
 * and reproduces `HumanResourcesComponent.openProfitDialog()` faithfully —
 * including the fact that the three totals come from `/employee-statistics/months`
 * rather than from summing the history rows, which report gross amounts and
 * would disagree with the HR dashboard's own figures.
 *
 * All three requests go through caches shared with the other widgets, so the
 * income history is the SAME request a Records History widget configured to
 * "Total Income" makes, and the totals are the same payload the HR info blocks
 * read.
 */
@Component({
	selector: 'ga-accounting-profit-history-widget',
	templateUrl: './profit-history-widget.component.html',
	styleUrls: ['./profit-history-widget.component.scss'],
	standalone: true,
	imports: [ProfitHistoryModule, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfitHistoryWidgetComponent extends BaseEmployeeHistoryWidgetComponent<IProfitHistoryRecords> {
	private readonly _monthStatisticsCache = inject(EmployeeMonthStatisticsCacheService);

	/**
	 * Fetches both histories and the monthly totals for the employee in scope.
	 *
	 * `combineLatest` rather than `forkJoin`: the cached streams are long-lived so
	 * they can re-emit after an invalidation, and `forkJoin` — which waits for
	 * completion — would never emit at all.
	 *
	 * @param context - The context to query for.
	 * @param employeeId - The employee in scope.
	 * @returns The records object the profit report renders.
	 */
	protected override fetch(context: IDashboardWidgetContext, employeeId: ID): Observable<IProfitHistoryRecords> {
		return combineLatest([
			this.statisticsCache.getStatisticsHistory(context, employeeId, EmployeeStatisticsHistoryEnum.INCOME),
			this.statisticsCache.getStatisticsHistory(context, employeeId, EmployeeStatisticsHistoryEnum.EXPENSES),
			this._monthStatisticsCache.getMonthStatistics(context, employeeId)
		]).pipe(
			map(
				([incomes, expenses, months]: [
					IEmployeeStatisticsHistory[],
					IEmployeeStatisticsHistory[],
					IMonthAggregatedEmployeeStatistics[]
				]) => {
					const totals = sumHrStatistics(months);

					return {
						incomes: incomes ?? [],
						expenses: expenses ?? [],
						incomeTotal: totals.income,
						expenseTotal: totals.expense,
						profit: totals.profit
					};
				}
			)
		);
	}

	/**
	 * Drops everything this widget cached, so a manual refresh really re-fetches.
	 *
	 * All three caches coalesce invalidations per scope, so the sibling widgets
	 * sharing these payloads still cause one request each rather than one per
	 * widget.
	 *
	 * @param context - The context the payload was fetched for.
	 * @param employeeId - The employee in scope.
	 */
	protected override invalidate(context: IDashboardWidgetContext, employeeId: ID): void {
		this.statisticsCache.invalidateHistory(context, employeeId, EmployeeStatisticsHistoryEnum.INCOME);
		this.statisticsCache.invalidateHistory(context, employeeId, EmployeeStatisticsHistoryEnum.EXPENSES);
		this._monthStatisticsCache.invalidate(context, employeeId);
	}
}
