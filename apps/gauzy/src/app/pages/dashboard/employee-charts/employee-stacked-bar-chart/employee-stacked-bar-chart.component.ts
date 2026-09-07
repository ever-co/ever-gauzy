import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { environment } from '@gauzy/ui-config';
import { CurrencyPosition, IMonthAggregatedEmployeeStatistics, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, monthNames } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CurrencyPositionPipe } from '@gauzy/ui-core/shared';
import { resolveEmployeeChartPalette } from '../employee-chart-palette';
import {
	employeeChartBarDataset,
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartLegend,
	employeeChartTooltip,
	employeeChartValueScale
} from '../employee-chart-options';

@UntilDestroy()
@Component({
    selector: 'ga-employee-stacked-bar-chart',
    template: `
		@if (noData) {
		  <div class="title">
		    <nb-icon icon="info-outline"></nb-icon>
		    <div>
		      {{ 'DASHBOARD_PAGE.CHARTS.NO_MONTH_DATA' | translate }}
		    </div>
		  </div>
		} @else {
		  <div class="chart">
		    <canvas baseChart [type]="'bar'" [data]="data" [options]="options"></canvas>
		  </div>
		}
		`,
    styles: [
        `
			:host {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				min-height: 0;
				width: 100%;

				/*
				 * position: relative is not decoration. With
				 * maintainAspectRatio disabled, Chart.js sizes the canvas from its
				 * OFFSET PARENT, and without a positioned ancestor it measures
				 * against something further up the tree and under-sizes the plot,
				 * leaving it small in the middle of the panel.
				 */
				.chart {
					position: relative;
					width: 100%;
					flex: 1 1 auto;
					min-height: 0;
					display: block;
				}
				.title {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.25rem;
					margin: auto;
					color: var(--gauzy-text-color-2);
					font-size: 0.75rem;
				}
			}
		`
    ],
    providers: [CurrencyPipe, CurrencyPositionPipe],
    standalone: false
})
export class EmployeeStackedBarChartComponent extends TranslationBaseComponent implements OnInit, OnDestroy, OnChanges {
	data: any;
	options: any;
	incomeStatistics: number[] = [];
	expenseStatistics: number[] = [];
	profitStatistics: number[] = [];
	bonusStatistics: number[] = [];
	labels: string[] = [];
	noData = false;

	/**
	 * The unscaled figures behind the plotted ones, per dataset index
	 * (0 = expenses, 1 = bonus, 2 = profit) then per month.
	 *
	 * The bars are normalised so each month's stack sums to that month's income —
	 * the chart's job is composition, not magnitude — which means the plotted
	 * number is a share and would be a lie if a tooltip printed it as money.
	 */
	private rawSeries: number[][] = [[], [], []];

	@Input()
	employeeStatistics: IMonthAggregatedEmployeeStatistics[];

	public organization: IOrganization;

	constructor(
		private themeService: NbThemeService,
		translateService: TranslateService,
		private readonly _elementRef: ElementRef<HTMLElement>,
		private readonly _currencyPipe: CurrencyPipe,
		private readonly _currencyPositionPipe: CurrencyPositionPipe,
		private readonly _store: Store
	) {
		super(translateService);
	}

	/**
	 * Formats the given value as currency.
	 *
	 * Same shape as the sibling charts', so a tooltip here and a tooltip on the
	 * bar or doughnut chart cannot disagree about how money looks.
	 */
	formatCurrency = (value: number): string => {
		const currencyPosition = this.organization?.currencyPosition || CurrencyPosition.LEFT;
		const currency = this._currencyPipe.transform(
			value,
			this.organization?.currency || environment.DEFAULT_CURRENCY
		);
		return this._currencyPositionPipe.transform(currency, currencyPosition);
	};

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
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
			.pipe(untilDestroyed(this))
			.subscribe((config) => {
				const palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);
				const bonusColors = this.bonusStatistics.map((val) =>
					val < 0 ? palette.negativeBonus : palette.bonus
				);
				const profitColors = this.profitStatistics.map((val) =>
					val < 0 ? palette.negativeProfit : palette.profit
				);
				this.data = {
					labels: this.labels,
					datasets: [
						{
							label: this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES'),
							...employeeChartBarDataset(palette),
							backgroundColor: palette.expenses,
							data: this.expenseStatistics
						},
						{
							label: this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
							...employeeChartBarDataset(palette),
							backgroundColor: bonusColors,
							data: this.bonusStatistics
						},
						{
							label: this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT'),
							...employeeChartBarDataset(palette),
							backgroundColor: profitColors,
							data: this.profitStatistics
						}
					]
				};
				this.options = {
					...employeeChartBase(),
					indexAxis: 'y',
					plugins: {
						legend: employeeChartLegend(palette),
						tooltip: employeeChartTooltip(
							palette,
							this.formatCurrency,
							(item) => this.rawSeries[item.datasetIndex]?.[item.dataIndex] ?? 0
						)
					},
					scales: {
						x: employeeChartValueScale(palette, true),
						y: employeeChartCategoryScale(palette, true)
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
		this.rawSeries = [[], [], []];

		this.noData = !(this.employeeStatistics || []).length;

		(this.employeeStatistics || []).forEach((stat) => {
			const labelValue = `${monthNames[stat.month]} '${stat.year.toString(10).substring(2)}`;
			this.labels.push(labelValue);
			// Scoped to the month it describes — it was a field, which made it read
			// like chart-wide state when it is recomputed on every iteration.
			const proportion = (stat.expense + stat.profit + stat.bonus) / stat.income || 1;
			this.expenseStatistics.push(Math.round((stat.expense / proportion) * 100) / 100);
			this.bonusStatistics.push(Math.round((stat.bonus / proportion) * 100) / 100);
			this.profitStatistics.push(Math.round((stat.profit / proportion) * 100) / 100);
			this.rawSeries[0].push(stat.expense);
			this.rawSeries[1].push(stat.bonus);
			this.rawSeries[2].push(stat.profit);
		});
	}

	ngOnDestroy() {}
}
