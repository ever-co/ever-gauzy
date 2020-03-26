import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import { SelectedEmployee } from '../../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-employee-stacked-bar-chart',
	template: `
		<chart
			style="height: 500px; width: 500px;"
			type="horizontalBar"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class EmployeeStackedBarChartComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	data: any;
	options: any;
	proportion: number;
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
	/**
	 * Loads or reloads chart statistics and chart when employee or date
	 * is changed from the header component
	 */
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
				const proportion = this.proportion;
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
							label: 'Expenses',
							backgroundColor: '#dbc300',
							data: this.expenseStatistics
						},
						{
							label: 'Bonus',
							backgroundColor: bonusColors,
							data: this.bonusStatistics
						},
						{
							label: 'Profit',
							backgroundColor: profitColors,
							data: this.profitStatistics
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
								},
								stacked: true
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
								},
								stacked: true
							}
						]
					},
					legend: {
						onClick: (e) => e.stopPropagation(),
						position: 'right',
						labels: {
							fontColor: chartjs.textColor
						}
					},
					tooltips: {
						enabled: false,
						callbacks: {
							label: function(tooltipItem, data) {
								let label =
									data.datasets[tooltipItem.datasetIndex]
										.label || '';
								if (label) {
									label += ': ';
								}
								label += tooltipItem.xLabel * proportion;
								return label;
							}
						}
					}
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
				valueDate: this.selectedDate,
				months: 12
			}
		);
		this.labels = [];
		this.incomeStatistics = [];
		this.expenseStatistics = [];
		this.profitStatistics = [];
		this.bonusStatistics = [];

		/**
		 * Populates the local statistics variables with fetched data.
		 */
		employeeStatistics.map((stat) => {
			this.labels.push('Revenue');
			this.proportion =
				(stat.expense + stat.profit + stat.bonus) / stat.income;
			this.expenseStatistics.push(stat.expense / this.proportion);
			this.bonusStatistics.push(stat.bonus / this.proportion);
			this.profitStatistics.push(stat.profit / this.proportion);
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
