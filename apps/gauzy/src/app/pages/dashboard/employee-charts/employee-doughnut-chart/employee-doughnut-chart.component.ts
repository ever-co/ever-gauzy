import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import { SelectedEmployee } from '../../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-employee-doughnut-chart',
	template: `
		<chart
			style="height: 500px; width: 500px;"
			type="doughnut"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class EmployeeDoughnutChartComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	data: any;
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	profitStatistics: number[] = [];
	bonusStatistics: number[] = [];
	labels: string[] = [];
	selectedDate: Date;
	selectedEmployee: SelectedEmployee;

	constructor(
		private themeService: NbThemeService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private store: Store,
		private errorHandler: ErrorHandlingService
	) {}

	/**
	 * Loads or reloads chart statistics and chart when employee or date
	 * is changed from the header component
	 */
	async ngOnInit() {
		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (date) => {
				this.selectedDate = date;
				await this._initializeChart();
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (emp) => {
				this.selectedEmployee = emp;
				await this._initializeChart();
			});
	}
	// /**
	//  * Loads or reloads chart statistics and chart when employee or date
	//  * is changed from the header component
	//  */
	private async _initializeChart() {
		if (
			this.selectedEmployee &&
			this.selectedEmployee.id &&
			this.selectedDate
		) {
			try {
				await this._loadData();
				this._LoadChart();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private _LoadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((config) => {
				const chartjs: any = config.variables.chartjs;
				this.data = {
					labels: ['Revenue', 'Expenses', 'Bonus', 'Profit'],
					datasets: [
						{
							data: [
								this.incomeStatistics,
								this.expenseStatistics,
								this.bonusStatistics,
								this.profitStatistics
							],
							backgroundColor: [
								'#089c17',
								'#dbc300',
								'#66de0b',
								'#0091ff'
							],
							hoverBorderColor: 'rgba(0, 0, 0, 0)',
							borderWidth: 1
						}
					]
				};
				this.options = {
					responsive: true,
					maintainAspectRatio: false,
					elements: {
						rectangle: {
							borderWidth: 2
						}
					},
					scales: {},
					legend: {
						position: 'right',
						labels: {
							fontColor: chartjs.textColor
						}
					}
				};
			});
	}
	// /**
	//  * Fetches selected employee's statistics for chosen date for past X months.
	//  * Populates the local statistics variables with fetched data.
	//  */
	private async _loadData() {
		/**
		 * Fetches selected employee's statistics for chosen date for past X months.
		 */
		const employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate,
				months: 12
			}
		);
		this.incomeStatistics = [];
		this.expenseStatistics = [];
		this.profitStatistics = [];
		this.bonusStatistics = [];

		/**
		 * Populates the local statistics variables with fetched data.
		 */
		employeeStatistics.map((stat) => {
			this.incomeStatistics.push(stat.income);
			this.expenseStatistics.push(stat.expense);
			this.profitStatistics.push(stat.profit);
			this.bonusStatistics.push(stat.bonus);
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
