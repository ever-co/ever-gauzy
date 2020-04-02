import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';
import { SelectedEmployee } from '../../../../@theme/components/header/selectors/employee/employee.component';
import { monthNames } from 'apps/gauzy/src/app/@core/utils/date';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-employee-doughnut-chart',
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
		<span *ngIf="!noData">{{ displayDate }}</span>
		<chart
			*ngIf="!noData"
			style="height: 500px; width: 500px;"
			type="doughnut"
			[data]="data"
			[options]="options"
		></chart>
	`
})
export class EmployeeDoughnutChartComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	data: any;
	options: any;
	incomeStatistics = 0;
	expenseStatistics = 0;
	profitStatistics = 0;
	bonusStatistics = 0;
	labels: string[] = [];
	selectedDate: Date;
	selectedEmployee: SelectedEmployee;
	displayDate: string;
	noData = false;

	constructor(
		private themeService: NbThemeService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private store: Store,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

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
				this.data = {
					labels: [
						this.getTranslation('DASHBOARD_PAGE.CHARTS.REVENUE'),
						this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES'),
						this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
						this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT')
					],
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
				valueDate: this.selectedDate || new Date(),
				months: 1
			}
		);

		this.noData = !employeeStatistics[0];

		this.incomeStatistics = employeeStatistics[0]
			? employeeStatistics[0].income
			: 0;
		this.expenseStatistics = employeeStatistics[0]
			? employeeStatistics[0].expense
			: 0;
		this.profitStatistics = employeeStatistics[0]
			? employeeStatistics[0].profit
			: 0;
		this.bonusStatistics = employeeStatistics[0]
			? employeeStatistics[0].bonus
			: 0;
		this.displayDate = employeeStatistics[0]
			? monthNames[employeeStatistics[0].month] +
			  ', ' +
			  employeeStatistics[0].year
			: '';
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
