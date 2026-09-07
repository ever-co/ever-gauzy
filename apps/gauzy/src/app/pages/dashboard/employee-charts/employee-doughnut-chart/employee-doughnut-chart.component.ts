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
import { employeeChartBase, employeeChartLegend, employeeChartTooltip } from '../employee-chart-options';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-employee-doughnut-chart',
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

		const legend = employeeChartLegend(this.palette, 'right');

		this.chartOptions = {
			...employeeChartBase(),
			// A doughnut rather than a pie: the hole keeps the four arcs thin, the
			// same "thin marks" rule the bar charts follow.
			cutout: '64%',
			// A circle centres itself in whatever box it is given, so the only
			// padding worth spending is a little breathing room around the ring.
			layout: { padding: { top: 4, right: 4, bottom: 4, left: 4 } },
			plugins: {
				legend: {
					...legend,
					/*
					 * Caps how much of the box the legend may claim, so the ring keeps
					 * the room it needs.
					 */
					maxWidth: 160,
					labels: {
						...(legend.labels as Record<string, unknown>),
						/*
						 * Series NAMES only.
						 *
						 * The amounts used to be appended here, which produced four
						 * ragged "name + figure" rows whose numbers did not line up in
						 * a column — a legend cannot lay out two columns. Every one of
						 * those figures is already stated twice on this page, in the
						 * KPI tile and again in the Breakdown panel, and the exact
						 * value is one hover away.
						 */
						generateLabels: (chart: any) => {
							const dataset = chart.data.datasets?.[0] ?? {};
							const colors = (dataset.backgroundColor ?? []) as string[];
							return ((chart.data.labels ?? []) as string[]).map((label, index) => ({
								text: label,
								fillStyle: colors[index],
								strokeStyle: colors[index],
								lineWidth: 0,
								pointStyle: 'circle',
								hidden: false,
								index
							}));
						}
					}
				},
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
		this.data = {
			// Names only. The legend appends each amount itself (see `generateLabels`)
			// and the tooltip formats its own, so baking the figure in here only made
			// the labels long enough to wrap.
			labels: [
				this.getTranslation('DASHBOARD_PAGE.CHARTS.REVENUE'),
				this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES'),
				this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
				this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT')
			],
			datasets: [
				{
					data: [
						this.statistics.income,
						this.statistics.expense,
						this.statistics.bonus,
						this.statistics.profit
					],
					backgroundColor: [
						this.palette.revenue,
						this.palette.expenses,
						this.palette.bonus,
						this.palette.profit
					],
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
