import { Component, OnInit, OnDestroy, Input, OnChanges } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { monthNames } from 'apps/gauzy/src/app/@core/utils/date';
import { TranslateService } from '@ngx-translate/core';
import { MonthAggregatedEmployeeStatistics } from '@gauzy/models';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-employee-doughnut-chart',
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
	implements OnInit, OnDestroy, OnChanges {
	private _ngDestroy$ = new Subject<void>();
	data: any;
	options: any;
	incomeStatistics = 0;
	expenseStatistics = 0;
	profitStatistics = 0;
	bonusStatistics = 0;
	labels: string[] = [];
	displayDate: string;
	noData = false;

	@Input()
	employeeStatistics: MonthAggregatedEmployeeStatistics[];

	constructor(
		private themeService: NbThemeService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadData();
		this._LoadChart();
	}

	ngOnChanges() {
		this._loadData();
		this._LoadChart();
	}

	private _loadData() {
		this.noData = !this.employeeStatistics[0];

		this.incomeStatistics = this.employeeStatistics[0]
			? this.employeeStatistics[0].income
			: 0;
		this.expenseStatistics = this.employeeStatistics[0]
			? this.employeeStatistics[0].expense
			: 0;
		this.profitStatistics = this.employeeStatistics[0]
			? this.employeeStatistics[0].profit
			: 0;
		this.bonusStatistics = this.employeeStatistics[0]
			? this.employeeStatistics[0].bonus
			: 0;
		this.displayDate = this.employeeStatistics[0]
			? monthNames[this.employeeStatistics[0].month] +
			  ', ' +
			  this.employeeStatistics[0].year
			: '';
	}

	private _LoadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((config) => {
				const chartjs: any = config.variables.chartjs;
				this.data = {
					labels: [
						`${this.getTranslation(
							'DASHBOARD_PAGE.CHARTS.REVENUE'
						)}: ${this.incomeStatistics}`,
						`${this.getTranslation(
							'DASHBOARD_PAGE.CHARTS.EXPENSES'
						)}: ${this.expenseStatistics}`,
						`${this.getTranslation(
							'DASHBOARD_PAGE.CHARTS.BONUS'
						)}: ${this.bonusStatistics}`,
						`${this.getTranslation(
							'DASHBOARD_PAGE.CHARTS.PROFIT'
						)}: ${this.profitStatistics}`
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
					},
					tooltips: {
						enabled: true,
						callbacks: {
							label: function(tooltipItem, data) {
								return data.labels[tooltipItem.index] || '';
							}
						}
					}
				};
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
