import { Component, ElementRef, OnInit, OnDestroy, Input, OnChanges, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType, TooltipItem } from 'chart.js';
import { environment } from '@gauzy/ui-config';
import { CurrencyPosition, IMonthAggregatedEmployeeStatistics, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { CurrencyPositionPipe } from '@gauzy/ui-core/shared';
import { Store } from '@gauzy/ui-core/core';
import { IEmployeeChartPalette, resolveEmployeeChartPalette } from '../employee-chart-palette';
import { employeeChartBase, employeeChartTooltip } from '../employee-chart-options';
import { IEmployeeChartLegendItem } from '../employee-chart-legend/employee-chart-legend.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-employee-doughnut-chart',
    template: `
		@if (employeeStatistics.length) {
		  <div class="chart">
		    <div class="chart-canvas">
		      <canvas baseChart [data]="data" [options]="chartOptions" [type]="chartType"></canvas>
		    </div>
		    <ga-employee-chart-legend class="chart-legend" [items]="legendItems"></ga-employee-chart-legend>
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

				/* The ring on the left, the legend naming its arcs on the right. */
				.chart {
					display: flex;
					align-items: center;
					gap: 1rem;
					width: 100%;
					flex: 1 1 auto;
					min-height: 0;
				}

				/*
				 * The ring's own box, and position: relative on it is not
				 * decoration: with maintainAspectRatio disabled, Chart.js sizes the
				 * canvas from its OFFSET PARENT, so without a positioned ancestor it
				 * measures against something further up the tree and draws a plot
				 * that does not match the space it was given.
				 *
				 * A doughnut inscribes itself in the SHORTER side of its box, so
				 * handing it the panel's full height is what makes the ring as large
				 * as the section allows and no larger.
				 */
				.chart-canvas {
					position: relative;
					flex: 1 1 auto;
					min-width: 0;
					height: 100%;
				}

				/*
				 * Content-sized and capped: the legend asks for the width its longest
				 * row needs, and past 45% of the panel the names ellipsize instead of
				 * eating into the ring. This is the job the canvas legend's maxWidth
				 * used to do, except the two now divide the panel in CSS rather than
				 * competing for one canvas rectangle.
				 */
				.chart-legend {
					flex: 0 1 auto;
					min-width: 0;
					max-width: 45%;
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
export class EmployeeDoughnutChartComponent extends TranslationBaseComponent implements OnInit, OnDestroy, OnChanges {
	public chartType: ChartType = 'doughnut';

	/*
	 * Parameterised with 'doughnut'. Bare `ChartConfiguration` resolves to the
	 * union over every registered chart type, whose options are only the ones
	 * common to all of them — so arc-only settings like `cutout` are not "known
	 * properties" there and the object literal is rejected.
	 */
	public chartOptions: ChartConfiguration<'doughnut'>['options'];
	public data: ChartConfiguration<'doughnut'>['data'];

	/** Slice colours for the active theme; see `employee-chart-palette.ts`. */
	private palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);

	public organization: IOrganization;

	/**
	 * The series named beside the ring, each with its total.
	 *
	 * Built alongside the dataset in {@link _initializeChartDataset} so a swatch
	 * cannot end up a different colour from the arc it stands for.
	 */
	public legendItems: IEmployeeChartLegendItem[] = [];
	public labels: string[] = [];
	public statistics = {
		income: 0 as number,
		expense: 0 as number,
		profit: 0 as number,
		bonus: 0 as number
	};
	public noData = false;

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

	constructor(
		public readonly translateService: TranslateService,
		private readonly _themeService: NbThemeService,
		private readonly _currencyPipe: CurrencyPipe,
		private readonly _currencyPositionPipe: CurrencyPositionPipe,
		private readonly _store: Store,
		private readonly _elementRef: ElementRef<HTMLElement>
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					/*
					 * The currency and its position come off the organization, and the
					 * tooltip picks them up for free: its callback calls `formatCurrency`
					 * at hover time. The legend does not — its amounts are strings built
					 * once, the last time the dataset was. Rebuilding them here keeps the
					 * two from disagreeing over the window between an organization change
					 * and the new statistics arriving, during which the legend would
					 * otherwise still be printing the previous organization's currency
					 * beside a tooltip already using the new one.
					 */
					this._getChartStatistics();
					this._initializeChartDataset();
				}),
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
			// A doughnut rather than a pie: the hole keeps the four arcs thin, the
			// same "thin marks" rule the bar charts follow.
			cutout: '64%',
			// A circle centres itself in whatever box it is given, so the only
			// padding worth spending is a little breathing room around the ring.
			layout: { padding: { top: 4, right: 4, bottom: 4, left: 4 } },
			plugins: {
				/*
				 * The legend is `ga-employee-chart-legend`, rendered in HTML beside
				 * the canvas. Chart.js cannot lay an entry out as two columns, so the
				 * amounts it drew after each name never lined up; and whatever width
				 * it claimed came out of the ring's own box.
				 */
				legend: { display: false },
				tooltip: {
					...employeeChartTooltip(this.palette, this.formatCurrency),
					callbacks: {
						title: () => '',
						// A doughnut has one unnamed dataset, so the series name lives on
						// the slice label rather than on `dataset.label` (which is what
						// the shared callback reads).
						label: (item: TooltipItem<ChartType>) =>
							`${item.label}: ${this.formatCurrency(Number(item.parsed) || 0)}`
					}
				}
			},
			scales: {}
		};

		// Step 13: Update the chart if it exists
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			this.baseChartDirective.chart.update();
		}

		this._initializeChartDataset();
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
		/*
		 * Name, value and colour as one row per series, rather than three parallel
		 * arrays that only agree while every one of them is edited together — and
		 * that the legend beside the ring would have had to be kept in step with as
		 * a fourth.
		 */
		const series = [
			{
				label: this.getTranslation('DASHBOARD_PAGE.CHARTS.REVENUE'),
				value: this.statistics.income,
				color: this.palette.revenue
			},
			{
				label: this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES'),
				value: this.statistics.expense,
				color: this.palette.expenses
			},
			{
				label: this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
				value: this.statistics.bonus,
				color: this.palette.bonus
			},
			{
				label: this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT'),
				value: this.statistics.profit,
				color: this.palette.profit
			}
		];

		// Each series' total, beside its name and in its own trailing column.
		this.legendItems = series.map(({ label, value, color }) => ({
			label,
			color,
			amount: this.formatCurrency(value)
		}));

		this.data = {
			// Names only on the arcs: the amount is the legend's column and the
			// tooltip formats its own, so baking the figure in here only made the
			// slice labels long enough to wrap.
			labels: series.map(({ label }) => label),
			datasets: [
				{
					data: series.map(({ value }) => value),
					backgroundColor: series.map(({ color }) => color),
					// A gap in the surface colour, not a ring: a border drawn around
					// each arc reads as chrome, a gap reads as separation.
					borderColor: this.palette.surface,
					borderWidth: 2,
					hoverBorderColor: this.palette.surface,
					hoverOffset: 4
				}
			]
		};
	}

	/**
	 * Populates the local statistics variables with input employeeStatistics data.
	 */
	private async _getChartStatistics() {
		this.statistics.income = this.employeeStatistics[0] ? this.employeeStatistics[0].income : 0;
		this.statistics.expense = this.employeeStatistics[0] ? this.employeeStatistics[0].expense : 0;
		this.statistics.profit = this.employeeStatistics[0] ? this.employeeStatistics[0].profit : 0;
		this.statistics.bonus = this.employeeStatistics[0] ? this.employeeStatistics[0].bonus : 0;
	}

	ngOnDestroy() {}
}
