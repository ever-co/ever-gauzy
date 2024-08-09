import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { tap } from 'rxjs/operators';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseChartDirective } from 'ng2-charts';
import {
	ActiveElement,
	Chart,
	ChartConfiguration,
	ChartDataset,
	ChartEvent,
	ChartType,
	TooltipItem
} from 'chart.js';
import { ChartUtil } from "./chart-utils";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: ' ngx-line-chart',
	templateUrl: './line-chart.component.html',
	styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnChanges, OnDestroy, OnInit {

	public lineChartType: ChartType = 'line';
	public lineChartLegend: boolean = true;
	public lineChartOptions: ChartConfiguration['options'];

	/**
	 * Private member to hold the actual data configuration for the chart.
	 */
	private _data: ChartConfiguration['data'];
	/**
	 * Public getter for the data property.
	 * Allows external access to the data configuration.
	 */
	public get data(): ChartConfiguration['data'] {
		return this._data;
	}
	/**
	 * Public setter for the data property.
	 * Sets the new value for data and updates the chart if applicable.
	 */
	@Input() public set data(value: ChartConfiguration['data']) {
		this._data = value;

		// Check if the baseChartDirective and chart properties exist
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			// If they exist, update the chart
			this.baseChartDirective.chart.update();
		}
	}

	@ViewChild(BaseChartDirective) baseChartDirective: BaseChartDirective;

	constructor(
		private readonly themeService: NbThemeService
	) { }

	ngOnInit() {
		const jsTheme$ = this.themeService.getJsTheme();
		jsTheme$
			.pipe(
				// Tap into the stream to execute a side effect (initialize the chart)
				tap((config: NbJSThemeOptions) => this.initializeChart(config)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes a Chart with the given configuration options.
	 * @param config - The configuration options for the Chart, including theme variables.
	 */
	initializeChart(config: NbJSThemeOptions) {
		// Step 1: Extract chartjs configuration from theme variables
		const chartJs: any = config.variables.chartjs;

		// Step 2: Set the overall chart options
		this.lineChartOptions = {
			responsive: true, // Makes the chart responsive
			maintainAspectRatio: false, // Allows adjusting the aspect ratio
			plugins: {
				// Step 3: Configure legend plugin
				legend: {
					position: 'bottom',
					labels: {
						color: chartJs.textColor,
						usePointStyle: false
					},
				},
				// Step 4: Configure tooltip plugin
				tooltip: {
					enabled: true,
					mode: 'point',
					position: 'average',
					displayColors: false,
					caretSize: 0,
					titleFont: {
						weight: 'bold',
					},
					titleColor: 'rgba(0,0,0,0.8)',
					bodyColor: 'rgba(0,0,0,0.5)',
					borderWidth: 3,
					backgroundColor: 'white',
					borderColor: "rgba(0,0,0,0.1)",
					callbacks: {
						// Step 5: Define callback for tooltip labels
						label: (tooltipItem: TooltipItem<ChartType>) => this.getTooltip(tooltipItem)
					}
				}
			},
			elements: {
				// Step 6: Configure line element
				line: {
					borderWidth: 2,
					backgroundColor: config.variables.primary
				},
			},
			scales: {
				// Step 7: Configure x-axis scale
				x: {
					grid: {
						display: true,
						color: chartJs.axisLineColor,
					},
					ticks: {
						color: chartJs.textColor,
						maxTicksLimit: 10
					}
				},
				// Step 8: Configure y-axis scale
				y: {
					grid: {
						display: true,
						color: chartJs.axisLineColor
					},
					ticks: {
						color: chartJs.textColor
					},
				},
			},
			hover: {
				// Step 9: Configure hover options
				mode: 'point',
				intersect: false,
			},
			// Step 10: Define hover event handler
			onHover: (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
				// Step 11: Handle hover behavior
				const canvas = event.native.target as HTMLCanvasElement;

				if (!elements || !elements.length) {
					// Reset styles if no elements are hovered
					this.data?.datasets?.forEach((dataset: ChartDataset<ChartType>) => {
						this.resetDatasetStyles(dataset);
					});
					canvas.style.cursor = 'default';
				} else {
					// Apply styles for hovered elements
					canvas.style.cursor = 'pointer';

					const datasetIndex = elements[0].datasetIndex;
					const activeDataset = this.data?.datasets?.[datasetIndex];

					if (activeDataset) {
						this.applyHoverStyles(activeDataset);
					}
				}

				// Update the chart
				chart.update();
			},
			// Step 12: Define click event handler
			onClick: () => {
				// Handle click events if needed
			}
		};
		// Step 13: Update the chart if it exists
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			this.baseChartDirective.chart.update();
		}
	}

	// Reset dataset styles
	private resetDatasetStyles(dataset: ChartDataset<ChartType>): void {
		dataset['borderWidth'] = 2;
		dataset['pointRadius'] = 2;
		dataset['pointBorderWidth'] = 2;
		dataset['pointBorderColor'] = dataset.borderColor;
		dataset['backgroundColor'] = ChartUtil.transparentize(dataset.backgroundColor, 1);
	}

	// Apply styles for hovered dataset
	private applyHoverStyles(activeDataset: ChartDataset<ChartType>): void {
		activeDataset['borderWidth'] = 4;
		activeDataset['pointRadius'] = 4;
		activeDataset['pointBorderWidth'] = 4;
		activeDataset['pointBorderColor'] = 'rgb(255, 255, 255)';
		activeDataset['backgroundColor'] = ChartUtil.transparentize(activeDataset.backgroundColor, 0.4);
		activeDataset['fill'] = true;
	}

	ngOnChanges(changes: SimpleChanges): void { }

	/**
	 * Customizes the tooltip content for a chart.
	 * @param tooltipItem - The tooltip item containing information about the data point.
	 * @returns The customized tooltip string.
	 */
	getTooltip(tooltipItem: TooltipItem<ChartType>) {
		// Initialize the tooltip with the label from tooltipItem
		let tooltip = tooltipItem.label;
		let formattedValue = tooltipItem.formattedValue;

		try {
			//
			const index = tooltipItem.datasetIndex;

			// Check if the chart and chart data exist
			if (this.baseChartDirective && this.baseChartDirective.chart) {
				// Retrieve the label from the dataset at the specified datasetIndex
				tooltip = this.baseChartDirective.data.datasets[index].label;

				// Capitalize the first letter and concatenate the rest in lowercase
				tooltip = tooltip[0] + tooltip.slice(1).toLocaleLowerCase();

				// Concatenate the tooltip with the actual value from tooltipItem
				tooltip += ": " + formattedValue;
			}
		} catch (error) {
			console.error(`An error occurred in getTooltip: ${error.message}`);
		}

		// Return the customized tooltip
		return tooltip;
	}

	/**
	 *
	 * @param param0
	 */
	public chartClicked({
		event,
		active,
	}: {
		event?: ChartEvent;
		active?: ActiveElement[];
	}): void { }

	/**
	 *
	 * @param param0
	 */
	public chartHovered({
		event,
		active,
	}: {
		event?: ChartEvent;
		active?: ActiveElement[];
	}): void {
		console.log(event, active);
	}

	ngOnDestroy() { }
}
