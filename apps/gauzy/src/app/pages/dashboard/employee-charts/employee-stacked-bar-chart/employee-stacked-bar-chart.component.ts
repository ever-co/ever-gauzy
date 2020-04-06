import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import { SelectedEmployee } from '../../../../@theme/components/header/selectors/employee/employee.component';
import { monthNames } from 'apps/gauzy/src/app/@core/utils/date';

@Component({
	selector: 'ngx-employee-stacked-bar-chart',
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
							label: this.selectedDate
								? `Expenses: ${Math.round(
										+this.expenseStatistics *
											this.proportion *
											100
								  ) / 100}`
								: 'Expenses',
							backgroundColor: '#dbc300',
							data: this.expenseStatistics
						},
						{
							label: this.selectedDate
								? `Bonus: ${Math.round(
										+this.bonusStatistics *
											this.proportion *
											100
								  ) / 100}`
								: 'Bonus',
							backgroundColor: bonusColors,
							data: this.bonusStatistics
						},
						{
							label: this.selectedDate
								? `Profit: ${Math.round(
										+this.profitStatistics *
											this.proportion *
											100
								  ) / 100}`
								: 'Profit',
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
					tooltips: this.selectedDate
						? {
								enabled: true,
								mode: 'dataset',
								callbacks: {
									label: function(tooltipItem, data) {
										const label =
											data.datasets[
												tooltipItem.datasetIndex
											].label || '';
										return label;
									}
								}
						  }
						: {
								enabled: true
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
			this.proportion =
				(stat.expense + stat.profit + stat.bonus) / stat.income;
			this.expenseStatistics.push(
				Math.round((stat.expense / this.proportion) * 100) / 100
			);
			this.bonusStatistics.push(
				Math.round((stat.bonus / this.proportion) * 100) / 100
			);
			this.profitStatistics.push(
				Math.round((stat.profit / this.proportion) * 100) / 100
			);
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
