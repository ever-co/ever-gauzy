import { Component, ElementRef, inject, Input, OnDestroy, OnInit, OnChanges, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { environment } from '@gauzy/ui-config';
import { CurrencyPosition, IMonthAggregatedEmployeeStatistics, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, months } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CurrencyPositionPipe } from '@gauzy/ui-core/shared';
import { IEmployeeChartPalette, resolveEmployeeChartPalette } from '../employee-chart-palette';
import {
	employeeChartBarDataset,
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartLegend,
	employeeChartTooltip,
	employeeChartValueScale
} from '../employee-chart-options';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-employee-horizontal-bar-chart',
    template: `
		@if (employeeStatistics.length) {
		  <div class="chart">
		    <canvas baseChart [data]="data" [options]="chartOptions" [type]="chartType"></canvas>
		  </div>
		} @else {
		  <div class="title">
		    <nb-icon icon="info-outline"></nb-icon>
		    <div>
		      {{ 'DASHBOARD_PAGE.CHARTS.NO_MONTH_DATA' | translate }}
		    </div>
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
				 * Fills the height the panel gives it rather than the old fixed
				 * 20rem, which took no account of the legend above the plot or the
				 * tick band below it.
				 */
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
export class EmployeeHorizontalBarChartComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, OnChanges
{
	public chartType: ChartType = 'bar';
	public chartOptions: ChartConfiguration['options'];
	public data: ChartConfiguration['data'];

	/** Series colours for the active theme; see `employee-chart-palette.ts`. */
	private palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);

	public organization: IOrganization;
	public labels: string[] = [];
	public statistics = {
		income: [] as number[],
		expense: [] as number[],
		profit: [] as number[],
		bonus: [] as number[]
	};

	/**
	 * Private property to store employee statistics data.
	 */
	private _employeeStatistics: IMonthAggregatedEmployeeStatistics[] = [];
	/**
	 * Getter for the employeeStatistics property.
	 */
	public get employeeStatistics(): IMonthAggregatedEmployeeStatistics[] {
		return this._employeeStatistics;
	}
	/**
	 * Setter for the employeeStatistics property with an @Input decorator.
	 * It updates the chart if the baseChartDirective and chart properties exist.
	 * @param value The new value for the employeeStatistics property.
	 */
	@Input() public set employeeStatistics(value: IMonthAggregatedEmployeeStatistics[]) {
		// Set the private property with the provided value
		this._employeeStatistics = value || [];
		// Check if the baseChartDirective and chart properties exist
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			// If they exist, update the chart
			this.baseChartDirective.chart.update();
		}
	}

	@ViewChild(BaseChartDirective, { static: false }) baseChartDirective: BaseChartDirective;

	private readonly _themeService = inject(NbThemeService);
	private readonly _currencyPipe = inject(CurrencyPipe);
	private readonly _currencyPositionPipe = inject(CurrencyPositionPipe);
	private readonly _store = inject(Store);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	/**
	 * Declared rather than inherited: `TranslationBaseComponent` takes an optional
	 * `TranslateService` and falls back to `inject()`, and a component that inherits
	 * a constructor with parameters from an undecorated base does not compile.
	 */
	constructor() {
		super();
	}

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
	}

	ngOnChanges() {
		const jsTheme$ = this._themeService.getJsTheme();
		jsTheme$
			.pipe(
				debounceTime(200),
				// Tap into the stream to execute a side effect (initialize the chart)
				tap((config: NbJSThemeOptions) => {
					this._getChartStatistics();
					this._initializeChart(config);
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes a Chart with the given configuration options.
	 * @param config - The configuration options for the Chart, including theme variables.
	 */
	private _initializeChart(config: NbJSThemeOptions) {
		this.palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);

		this.chartOptions = {
			...employeeChartBase(),
			indexAxis: 'y',
			plugins: {
				legend: employeeChartLegend(this.palette),
				tooltip: employeeChartTooltip(this.palette, this.formatCurrency)
			},
			scales: {
				// Horizontal bars: x carries the money, y carries the months.
				x: employeeChartValueScale(this.palette),
				y: employeeChartCategoryScale(this.palette)
			}
		};

		// Update the chart if it exists
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			this.baseChartDirective.chart.update();
		}

		this._initializeChartDataset();
	}

	/**
	 * Determines the colors for bonus values.
	 * @returns An array of color codes.
	 */
	private getBonusColors(): string[] {
		return this.statistics.bonus.map((val) => (val < 0 ? this.palette.negativeBonus : this.palette.bonus));
	}

	/**
	 * Determines the colors for profit values.
	 * @returns An array of color codes.
	 */
	private getProfitColors(): string[] {
		return this.statistics.profit.map((val) => (val < 0 ? this.palette.negativeProfit : this.palette.profit));
	}

	/**
	 * Formats the given value as currency.
	 * @param value - The numeric value to be formatted.
	 * @returns The formatted currency string.
	 */
	formatCurrency = (value: number): string => {
		const currencyPosition = this.organization?.currencyPosition || CurrencyPosition.LEFT;
		const currency = this._currencyPipe.transform(
			value,
			this.organization?.currency || environment.DEFAULT_CURRENCY
		);
		return this._currencyPositionPipe.transform(currency, currencyPosition);
	};

	/**
	 * Initializes the chart dataset with appropriate colors and labels.
	 */
	private _initializeChartDataset(): void {
		// Get colors for bonus and profit based on their values
		const bonusColors = this.getBonusColors();
		const profitColors = this.getProfitColors();

		const income = this.formatCurrency(this.statistics.income[0]);
		const expense = this.formatCurrency(this.statistics.expense[0]);
		const bonus = this.formatCurrency(this.statistics.bonus[0]);
		const profit = this.formatCurrency(this.statistics.profit[0]);

		// Set up the 'data' object for the chart with labels and datasets
		this.data = {
			labels: this.labels,
			datasets: [
				{
					label: `${this.getTranslation('DASHBOARD_PAGE.CHARTS.REVENUE')}: ${income}`,
					backgroundColor: this.palette.revenue,
					data: this.statistics.income // Data values for the revenue dataset
				},
				{
					label: `${this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES')}: ${expense}`,
					backgroundColor: this.palette.expenses,
					data: this.statistics.expense // Data values for the expenses dataset
				},
				{
					label: `${this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT')}: ${profit}`,
					backgroundColor: profitColors, // Background colors for the profit dataset
					data: this.statistics.profit // Data values for the profit dataset
				},
				{
					label: `${this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS')}: ${bonus}`,
					backgroundColor: bonusColors, // Background colors for the bonus dataset
					data: this.statistics.bonus // Data values for the bonus dataset
				}
			].map((dataset) => ({
				...employeeChartBarDataset(this.palette),
				...dataset
			}))
		};
	}

	/**
	 * Populates the local statistics variables with input employeeStatistics data.
	 */
	private async _getChartStatistics() {
		// Function to map specific statistics key from each item in employeeStatistics
		const mapStatistics = (key: string) => (this.employeeStatistics ?? []).map((stat) => stat[key]);

		// Function to generate labels based on month names and year
		const mapMonthLabel = (stat: any) => `${months[stat.month]} '${stat.year.toString(10).substring(2)}`;

		// Populate labels array by mapping each item using mapMonthLabel function
		this.labels = (this.employeeStatistics ?? []).map(mapMonthLabel) || [];

		// Populate statistics object with income, expense, profit, and bonus properties
		this.statistics = {
			income: mapStatistics('income'),
			expense: mapStatistics('expense'),
			profit: mapStatistics('profit'),
			bonus: mapStatistics('bonus')
		};
	}

	ngOnDestroy() {}
}
