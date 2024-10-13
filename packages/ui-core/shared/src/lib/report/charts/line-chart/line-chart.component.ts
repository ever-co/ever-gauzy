import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import { tap } from 'rxjs/operators';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ActiveElement, Chart, ChartConfiguration, ChartDataset, ChartEvent, ChartType, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import annotationPlugin, { AnnotationPluginOptions } from 'chartjs-plugin-annotation';
import { DEFAULT_STANDARD_WORK_HOURS_PER_DAY } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ChartUtil } from './chart-utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: ' ngx-line-chart',
	templateUrl: './line-chart.component.html',
	styleUrls: ['./line-chart.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LineChartComponent extends TranslationBaseComponent implements OnChanges, OnDestroy, OnInit {
	public lineChartType: ChartType = 'line';
	public lineChartOptions: ChartConfiguration['options'];

	/**
	 * A flag that enables or disables the annotations plugin dynamically.
	 *
	 * This property is used to control whether annotations should be included in the chart's configuration.
	 * If set to `true`, the annotations (such as the "Standard Work Hours" line) will be displayed.
	 * If set to `false`, the annotations will be omitted from the chart.
	 *
	 * This allows dynamic control over the chart's features, enabling you to customize the chart based on
	 * different pages or user preferences.
	 *
	 * @input enableAnnotations - A boolean value that toggles the annotations plugin.
	 *                            Defaults to `false` (no annotations).
	 *                            Set to `true` to enable annotations in the chart.
	 *
	 * Example usage:
	 * ```
	 * <ngx-line-chart
	 *   [data]="charts"
	 *   [standardWorkHours]="organization?.standardWorkHoursPerDay"
	 *   [enableAnnotations]="enableAnnotations"
	 * ></ngx-line-chart>
	 * ```
	 */
	@Input() enableAnnotations: boolean = false;

	/**
	 * The standard work hours per day that can be passed from the parent component.
	 * If not provided, it defaults to `DEFAULT_STANDARD_WORK_HOURS_PER_DAY`.
	 *
	 * @input standardWorkHours - The number of standard work hours to be displayed on the chart.
	 */
	@Input() public standardWorkHours: number = DEFAULT_STANDARD_WORK_HOURS_PER_DAY;

	/**
	 * A boolean input property that determines whether the chart legend
	 * should be displayed or hidden.
	 *
	 * @input lineChartLegend - When true, the chart legend is displayed.
	 *                          When false, the chart legend is hidden.
	 *                          Defaults to true if no value is provided.
	 */
	@Input() public lineChartLegend: boolean = true;

	/**
	 * Private member to hold the actual data configuration for the chart.
	 */
	private _data: ChartConfiguration['data'];
	/**
	 * Public setter for the data property.
	 * Sets the new value for data and updates the chart if applicable.
	 */
	@Input() public set data(value: ChartConfiguration['data']) {
		this._data = value;
		this.refreshChart(); // Refresh the chart if it exists
	}
	/**
	 * Public getter for the data property.
	 * Allows external access to the data configuration.
	 */
	public get data(): ChartConfiguration['data'] {
		return this._data;
	}

	/**
	 * A reference to the `BaseChartDirective` instance in the component's view.
	 *
	 * @viewChild baseChartDirective - A reference to the `BaseChartDirective` instance that manages the Chart.js object
	 *                                 inside the component, allowing direct control over the chart's rendering and behavior.
	 */
	@ViewChild(BaseChartDirective) baseChartDirective: BaseChartDirective;

	constructor(private readonly themeService: NbThemeService, public readonly translate: TranslateService) {
		super(translate);
		Chart.register(annotationPlugin); // Register the annotation plugin globally
	}

	ngOnInit() {
		this.themeService
			.getJsTheme()
			.pipe(
				// Tap into the stream to execute a side effect (initialize the chart)
				tap((config: NbJSThemeOptions) => this.initializeChart(config)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(changes: SimpleChanges): void {
		// Detect changes to standardWorkHours or enableAnnotations
		if (changes.standardWorkHours?.currentValue || changes.enableAnnotations?.currentValue) {
			this.refreshChart();
		}
	}

	/**
	 * Detects the current theme (light or dark) and returns appropriate label text
	 * and background colors.
	 *
	 * @returns An object containing the label text color and background color for the current theme.
	 */
	public getThemeColors() {
		const isDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

		return {
			labelTextColor: isDarkTheme ? 'white' : 'black',
			labelBackgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'
		};
	}

	/**
	 * Generates the annotation configuration for the chart, including theme-based label colors
	 * and other styling for the standard work hours line.
	 *
	 * This method dynamically applies theme-specific colors for the annotation label and
	 * uses the standard work hours to determine the position of the horizontal line.
	 *
	 * @returns The final annotation configuration with dynamic label colors and styles applied.
	 */
	public getAnnotationConfig(): AnnotationPluginOptions {
		// Retrieve theme-specific label colors and translation for the label content
		const { labelTextColor, labelBackgroundColor } = this.getThemeColors();
		const standardWorkHours = this.standardWorkHours || DEFAULT_STANDARD_WORK_HOURS_PER_DAY;
		const labelContent = this.getTranslation('REPORT_PAGE.STANDARD_WORK_HOURS', { hours: standardWorkHours });

		// Return the annotation configuration
		return {
			annotations: {
				line1: {
					type: 'line',
					yMin: standardWorkHours,
					yMax: standardWorkHours,
					borderColor: 'lightgrey',
					borderWidth: 2,
					borderDash: [5, 5],
					label: {
						display: true,
						content: labelContent,
						position: 'end', // Moves the label below the line (adjust as needed)
						yAdjust: 15, // Moves the label down by 15px (adjust as needed)
						color: labelTextColor, // Dynamic text color based on theme
						backgroundColor: labelBackgroundColor, // Dynamic background color
						font: {
							weight: 'bold',
							size: 12
						},
						padding: {
							top: 6,
							bottom: 6,
							left: 6,
							right: 6
						}
					}
				}
			}
		};
	}

	/**
	 * Initializes a Chart with the given configuration options.
	 * @param config - The configuration options for the Chart, including theme variables.
	 */
	initializeChart(config: NbJSThemeOptions) {
		// Step 1: Extract chartjs configuration from theme variables
		const chartJs: any = config.variables.chartjs;
		// Get a reference to the current instance of the component
		const instance = this;

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
					}
				},
				// Step 4: Configure tooltip plugin
				tooltip: {
					enabled: true,
					mode: 'point',
					position: 'average',
					displayColors: false,
					caretSize: 0,
					titleFont: {
						weight: 'bold'
					},
					titleColor: 'rgba(0,0,0,0.8)',
					bodyColor: 'rgba(0,0,0,0.5)',
					borderWidth: 3,
					backgroundColor: 'white',
					borderColor: 'rgba(0,0,0,0.1)',
					callbacks: {
						// Step 5: Define callback for tooltip labels
						label: (tooltipItem: TooltipItem<ChartType>) => this.getTooltip(tooltipItem)
					}
				},
				// Step 5: Add annotation plugin configuration
				...(instance.enableAnnotations ? { annotation: instance.getAnnotationConfig() } : {})
			},
			elements: {
				// Step 6: Configure line element
				line: {
					borderWidth: 2,
					backgroundColor: config.variables.primary
				}
			},
			scales: {
				// Step 7: Configure x-axis scale
				x: {
					grid: {
						display: true,
						color: chartJs.axisLineColor
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
					}
				}
			},
			hover: {
				// Step 9: Configure hover options
				mode: 'point',
				intersect: false
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
			// Get index of the dataset
			const index = tooltipItem.datasetIndex;
			// Check if the chart and chart data exist
			if (this.baseChartDirective && this.baseChartDirective.chart) {
				// Retrieve the label from the dataset at the specified datasetIndex
				tooltip = this.baseChartDirective.data.datasets[index].label;
				// Capitalize the first letter and concatenate the rest in lowercase
				tooltip = tooltip[0] + tooltip.slice(1).toLocaleLowerCase();
				// Concatenate the tooltip with the actual value from tooltipItem
				tooltip += ': ' + formattedValue;
			}
		} catch (error) {
			console.error(`An error occurred in getTooltip: ${error.message}`);
		}

		// Return the customized tooltip
		return tooltip;
	}

	/**
	 * Handles the click event on the chart.
	 * When the user clicks on a specific chart element (data point),
	 * this method can be used to trigger additional actions like showing details or navigating to another view.
	 *
	 * @param param0 - An object containing the event and active elements.
	 * @param event - The event triggered by the chart click.
	 * @param active - The active chart elements at the time of the click (e.g., the data points that were clicked on).
	 */
	public chartClicked({ event, active }: { event?: ChartEvent; active?: ActiveElement[] }): void {
		if (active && active.length) {
			// Perform action based on the clicked data point(s)
			const chartElement = active[0]; // Access the first active element
			console.log('Chart clicked at:', chartElement);
			// Additional actions can be implemented here (e.g., showing details, modifying chart, etc.)
		} else {
			console.log('Chart was clicked, but no data points were active.');
		}
	}

	/**
	 * Handles the hover event on the chart.
	 * This method triggers when the user hovers over a specific chart element (data point),
	 * and can be used to display information or modify the hover style.
	 *
	 * @param param0 - An object containing the event and active elements.
	 * @param event - The event triggered by the hover action.
	 * @param active - The active chart elements that are hovered over (e.g., the data points).
	 */
	public chartHovered({ event, active }: { event?: ChartEvent; active?: ActiveElement[] }): void {
		if (active && active.length) {
			// Perform action based on the hovered data point(s)
			const chartElement = active[0]; // Access the first hovered element
			console.log('Chart hovered over:', chartElement);
			// Additional hover actions (e.g., highlighting, showing tooltips, etc.)
		} else {
			console.log('Chart hovered, but no data points were active.');
		}
	}

	/**
	 * Refreshes the chart by updating its data or options.
	 * The method ensures that the chart is only updated if the `BaseChartDirective` is properly initialized.
	 *
	 * Example usage:
	 * ```
	 * this.refreshChart();
	 * ```
	 */
	private refreshChart(): void {
		// Check if the baseChartDirective and chart properties exist
		if (this.baseChartDirective && this.baseChartDirective.chart) {
			// If they exist, update the chart
			this.baseChartDirective.chart.update();
		}
	}

	ngOnDestroy() {}
}
