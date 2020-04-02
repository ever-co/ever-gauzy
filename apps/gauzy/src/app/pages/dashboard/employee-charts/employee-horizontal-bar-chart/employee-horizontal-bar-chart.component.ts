import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { monthNames } from '../../../../@core/utils/date';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import { SelectedEmployee } from '../../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-employee-horizontal-bar-chart',
	template: `
		<div
			*ngIf="noData"
			style="display: flex; flex-direction: column; align-items: center;"
		>
			<nb-icon icon="info-outline"></nb-icon>
			<div>
				{{ 'DASHBOARD_PAGE.CHARTS.NO_MONTH_DATA' | translate }}
			</div>
		</div>
		<chart
			*ngIf="!noData"
			style="height: 500px; width: 500px;"
			type="horizontalBar"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class EmployeeHorizontalBarChartComponent implements OnInit, OnDestroy {
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
	noData = false;

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
	/**
	 * Loads or reloads chart statistics and chart when employee or date
	 * is changed from the header component
	 */
	private async _initializeChart() {
		if (this.selectedEmployee && this.selectedEmployee.id) {
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
				const bonusColors = this.bonusStatistics.map((val) =>
					val < 0 ? 'red' : '#0091ff'
				);
				const profitColors = this.profitStatistics.map((val) =>
					val < 0 ? '#ff7b00' : '#66de0b'
				);
				this.data = {
					labels: this.labels,
					datasets: [
						{
							// label: `Revenue: ${this.incomeStatistics}`,
							label: `Revenue`,
							backgroundColor: '#089c17',
							borderWidth: 1,
							data: this.incomeStatistics
						},
						{
							// label: `Expenses: ${this.expenseStatistics}`,
							label: `Expenses`,
							backgroundColor: '#dbc300',
							data: this.expenseStatistics
						},
						{
							// label: `Profit: ${this.profitStatistics}`,
							label: `Profit`,
							backgroundColor: profitColors,
							data: this.profitStatistics
						},
						{
							// label: `Bonus: ${this.bonusStatistics}`,
							label: `Bonus`,
							backgroundColor: bonusColors,
							data: this.bonusStatistics
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
					scales: {
						xAxes: [
							{
								gridLines: {
									display: true,
									color: chartjs.axisLineColor
								},
								ticks: {
									fontColor: chartjs.textColor
								}
							}
						],
						yAxes: [
							{
								gridLines: {
									display: false,
									color: chartjs.axisLineColor
								},
								ticks: {
									fontColor: chartjs.textColor
								}
							}
						]
					},
					legend: {
						position: 'right',
						labels: {
							fontColor: chartjs.textColor
						}
					}
					// tooltips: {
					// 	enabled: true,
					// 	mode: 'dataset',
					// 	callbacks: {
					// 		label: function(tooltipItem, data) {
					// 			const label =
					// 				data.datasets[tooltipItem.datasetIndex]
					// 					.label || '';
					// 			return label;
					// 		}
					// 	}
					// }
				};
			});
	}
	/**
	 * Fetches selected employee's statistics for chosen date for past X months.
	 * Populates the local statistics variables with fetched data.
	 */
	private async _loadData() {
		/**
		 * Fetches selected employee's statistics for chosen date for past X months.
		 */
		const employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12
			}
		);
		this.labels = [];
		this.incomeStatistics = [];
		this.expenseStatistics = [];
		this.profitStatistics = [];
		this.bonusStatistics = [];

		this.noData = !(employeeStatistics || []).length;

		/**
		 * Populates the local statistics variables with fetched data.
		 */
		(employeeStatistics || []).map((stat) => {
			const labelValue = `${monthNames[stat.month]} '${stat.year
				.toString(10)
				.substring(2)}`;
			this.labels.push(labelValue);
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
