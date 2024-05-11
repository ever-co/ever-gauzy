import { Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { monthNames } from '@gauzy/ui-sdk/core';
import { IMonthAggregatedEmployeeStatistics } from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-employee-stacked-bar-chart',
	template: `
		<div *ngIf="noData" style="display: flex; flex-direction: column; align-items: center;">
			<nb-icon icon="info-outline"></nb-icon>
			<div>
				{{ 'DASHBOARD_PAGE.CHARTS.NO_MONTH_DATA' | translate }}
			</div>
		</div>
		<canvas
			*ngIf="!noData"
			style="height: 500px; width: 500px;"
			baseChart
			[type]="'bar'"
			[data]="data"
			[options]="options"
		></canvas>
	`
})
export class EmployeeStackedBarChartComponent extends TranslationBaseComponent implements OnInit, OnDestroy, OnChanges {
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
	noData = false;

	@Input()
	employeeStatistics: IMonthAggregatedEmployeeStatistics[];

	constructor(private themeService: NbThemeService, translateService: TranslateService) {
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

	private _LoadChart() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((config) => {
				const chartjs: any = config.variables.chartjs;
				const bonusColors = this.bonusStatistics.map((val) => (val < 0 ? 'red' : '#0091ff'));
				const profitColors = this.profitStatistics.map((val) => (val < 0 ? '#ff7b00' : '#66de0b'));
				this.data = {
					labels: this.labels,
					datasets: [
						{
							label: this.selectedDate
								? `${this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES')}: ${
										Math.round(+this.expenseStatistics * this.proportion * 100) / 100
								  }`
								: this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES'),
							backgroundColor: '#dbc300',
							data: this.expenseStatistics
						},
						{
							label: this.selectedDate
								? `${this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS')}: ${
										Math.round(+this.bonusStatistics * this.proportion * 100) / 100
								  }`
								: this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
							backgroundColor: bonusColors,
							data: this.bonusStatistics
						},
						{
							label: this.selectedDate
								? `${this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT')}: ${
										Math.round(+this.profitStatistics * this.proportion * 100) / 100
								  }`
								: this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT'),
							backgroundColor: profitColors,
							data: this.profitStatistics
						}
					]
				};
				this.options = {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					elements: {
						rectangle: {
							borderWidth: 2
						}
					},
					scales: {
						x: {
							stacked: true
						},
						y: {
							stacked: true
						}
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
									label: function (tooltipItem, data) {
										const label = data.datasets[tooltipItem.datasetIndex].label || '';
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
	 * Populates the local statistics variables with input employeeStatistics.
	 */
	private async _loadData() {
		this.labels = [];
		this.incomeStatistics = [];
		this.expenseStatistics = [];
		this.profitStatistics = [];
		this.bonusStatistics = [];

		this.noData = !(this.employeeStatistics || []).length;

		(this.employeeStatistics || []).forEach((stat) => {
			const labelValue = `${monthNames[stat.month]} '${stat.year.toString(10).substring(2)}`;
			this.labels.push(labelValue);
			this.proportion = (stat.expense + stat.profit + stat.bonus) / stat.income || 1;
			this.expenseStatistics.push(Math.round((stat.expense / this.proportion) * 100) / 100);
			this.bonusStatistics.push(Math.round((stat.bonus / this.proportion) * 100) / 100);
			this.profitStatistics.push(Math.round((stat.profit / this.proportion) * 100) / 100);
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
