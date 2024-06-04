import { Component, OnInit, OnDestroy, Input, OnChanges, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType, TooltipItem } from 'chart.js';
import { environment } from '@gauzy/ui-config';
import { CurrencyPosition, IMonthAggregatedEmployeeStatistics, IOrganization } from '@gauzy/contracts';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { CurrencyPositionPipe } from './../../../../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-doughnut-chart',
	template: `
		<ng-template [ngIf]="employeeStatistics.length" [ngIfElse]="chartNotFoundTemplate">
			<!-- <span>{{ displayDate }}</span> -->
			<canvas
				style="height: 500px; width: 500px;"
				baseChart
				[data]="data"
				[options]="chartOptions"
				[type]="chartType"
			></canvas>
		</ng-template>
		<ng-template #chartNotFoundTemplate>
			<div class="title">
				<nb-icon icon="info-outline"></nb-icon>
				<div>
					{{ 'DASHBOARD_PAGE.CHARTS.NO_MONTH_DATA' | translate }}
				</div>
			</div>
		</ng-template>
	`,
	styles: [
		`
			:host {
				.title {
					display: flex;
					flex-direction: column;
					align-items: center;
				}
			}
		`
	],
	providers: [CurrencyPipe, CurrencyPositionPipe]
})
export class EmployeeDoughnutChartComponent extends TranslationBaseComponent implements OnInit, OnDestroy, OnChanges {
	public chartType: ChartType = 'doughnut';
	public chartOptions: ChartConfiguration['options'];
	public data: ChartConfiguration['data'];

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
		private readonly _store: Store
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
		// Step 1: Extract chartjs configuration from theme variables
		const chartJs: any = config.variables.chartjs;

		// Step 2: Set the overall chart options
		this.chartOptions = {
			responsive: true, // Makes the chart responsive
			maintainAspectRatio: false, // Allows adjusting the aspect ratio
			indexAxis: 'y',
			// Elements options apply to all of the options unless overridden in a dataset
			// In this case, we are setting the border of each horizontal bar to be 2px wide
			elements: {
				arc: {
					borderWidth: 2
				}
			},
			plugins: {
				legend: {
					position: 'top',
					labels: {
						color: chartJs.textColor,
						usePointStyle: false
					}
				},
				tooltip: {
					enabled: true,
					// Define callback for tooltip labels
					callbacks: {
						title: () => '',
						label: (tooltipItem: TooltipItem<ChartType>) => this.getTooltip(tooltipItem)
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
		const income = this.formatCurrency(this.statistics.income);
		const expense = this.formatCurrency(this.statistics.expense);
		const bonus = this.formatCurrency(this.statistics.bonus);
		const profit = this.formatCurrency(this.statistics.profit);

		this.data = {
			labels: [
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.REVENUE')}: ${income}`,
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.EXPENSES')}: ${expense}`,
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS')}: ${bonus}`,
				`${this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT')}: ${profit}`
			],
			datasets: [
				{
					data: [
						this.statistics.income,
						this.statistics.expense,
						this.statistics.bonus,
						this.statistics.profit
					],
					backgroundColor: ['#089c17', '#dbc300', '#66de0b', '#0091ff'],
					hoverBorderColor: 'rgba(0, 0, 0, 0)',
					borderWidth: 1
				}
			]
		};
	}

	/**
	 * Customizes the tooltip content for a chart.
	 * @param tooltipItem - The tooltip item containing information about the data point.
	 * @returns The customized tooltip string.
	 */
	getTooltip(tooltipItem: TooltipItem<ChartType>) {
		// Initialize the tooltip with the label from tooltipItem
		let tooltip = tooltipItem.label;

		// Return the customized tooltip
		return tooltip;
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
