import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	Input,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, TooltipItem } from 'chart.js';
import { debounceTime, tap } from 'rxjs/operators';
import {
	IEmployeeChartPalette,
	resolveEmployeeChartPalette
} from '../../../dashboard/employee-charts/employee-chart-palette';
import {
	abbreviateNumber,
	employeeChartBarDataset,
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartTooltip,
	employeeChartValueScale
} from '../../../dashboard/employee-charts/employee-chart-options';
import { IExpenseChartBar } from '../expense-view-charts';

/**
 * Amounts as bars, the expense's own bar in the expenses colour and the others in a second hue, so the expense
 * stands out among them. Painted with the dashboard's chart helpers and theme tokens, like the employee and task
 * pages' hours charts; the legend is HTML above the plot, so which bar is which never rests on hue alone.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-bar-chart',
	template: `
		<ul class="legend">
			<li><span class="swatch" [style.background-color]="palette.expenses"></span>{{ highlightLabel }}</li>
			<li><span class="swatch" [style.background-color]="palette.bonus"></span>{{ otherLabel }}</li>
		</ul>
		<div class="canvas">
			<canvas baseChart type="bar" [data]="data" [options]="options"></canvas>
		</div>
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				flex: 1 1 auto;
				min-height: 0;
			}
			.legend {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 0.875rem;
				margin: 0;
				padding: 0;
				list-style: none;
				color: var(--gauzy-text-color-2);
			}
			/* Sized on the item itself: a global rule sets every li to 14px. */
			.legend li {
				display: inline-flex;
				align-items: center;
				gap: 0.3125rem;
				font-size: 0.6875rem;
				line-height: 1rem;
			}
			.swatch {
				width: 0.4375rem;
				height: 0.4375rem;
				border-radius: 50%;
			}
			/* Chart.js sizes the canvas from its positioned parent. */
			.canvas {
				position: relative;
				flex: 1 1 auto;
				min-height: 0;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: true,
	imports: [BaseChartDirective]
})
export class ExpenseBarChartComponent implements OnInit, AfterViewInit, OnDestroy {
	private _bars: IExpenseChartBar[] = [];
	@Input() set bars(value: IExpenseChartBar[]) {
		this._bars = value || [];
		this.buildData();
	}

	/** The legend's name for the expense's own bar. */
	@Input() highlightLabel = '';
	/** The legend's name for the other bars. */
	@Input() otherLabel = '';

	/** Formats an amount for the tooltip, in the expense's currency. */
	@Input() formatValue: (value: number) => string = (value) => String(value);

	public palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);
	public data: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
	public options: ChartConfiguration<'bar'>['options'];

	@ViewChild(BaseChartDirective) private readonly _chart?: BaseChartDirective;

	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	/** Chart.js measures its box once; the panel settles after that, so the chart re-measures with it. */
	private readonly _resizeObserver =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.remeasure()) : null;

	/** Axis tick size: a step below the legend, so the data reads first. */
	private static readonly TICK_FONT = { size: 10 };

	ngOnInit(): void {
		this._resizeObserver?.observe(this._elementRef.nativeElement);
		this._themeService
			.getJsTheme()
			.pipe(
				debounceTime(100),
				tap((config: NbJSThemeOptions) => {
					this.palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);
					this.buildOptions();
					this.buildData();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.remeasure();
	}

	ngOnDestroy(): void {
		this._resizeObserver?.disconnect();
	}

	private remeasure(): void {
		requestAnimationFrame(() => this._chart?.chart?.resize());
	}

	private buildOptions(): void {
		const valueScale = employeeChartValueScale(this.palette) as any;
		const categoryScale = employeeChartCategoryScale(this.palette) as any;
		const tooltip = employeeChartTooltip(this.palette, (value) => this.formatValue(value)) as any;
		this.options = {
			...employeeChartBase(),
			interaction: { mode: 'index', intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: {
					...tooltip,
					callbacks: {
						...tooltip.callbacks,
						// The full date or month, where the axis has room only for a short one.
						title: (items: TooltipItem<'bar'>[]) => this._bars[items[0]?.dataIndex]?.title ?? '',
						// One dataset carries both kinds of bar, so the series name comes from the bar itself.
						label: (item: TooltipItem<'bar'>) => {
							const series = this._bars[item.dataIndex]?.highlight ? this.highlightLabel : this.otherLabel;
							return `${series}: ${this.formatValue(Number(item.parsed?.y) || 0)}`;
						}
					}
				}
			},
			scales: {
				x: {
					...categoryScale,
					ticks: {
						...categoryScale.ticks,
						font: ExpenseBarChartComponent.TICK_FONT,
						maxRotation: 0,
						minRotation: 0,
						autoSkip: true,
						autoSkipPadding: 12
					}
				},
				y: {
					...valueScale,
					beginAtZero: true,
					ticks: {
						...valueScale.ticks,
						font: ExpenseBarChartComponent.TICK_FONT,
						callback: (value: number | string) => abbreviateNumber(Number(value))
					}
				}
			}
		};
	}

	private buildData(): void {
		const colours = this._bars.map((bar) => (bar.highlight ? this.palette.expenses : this.palette.bonus));
		this.data = {
			labels: this._bars.map((bar) => bar.label),
			datasets: [
				{
					...employeeChartBarDataset(this.palette),
					data: this._bars.map((bar) => bar.value),
					backgroundColor: colours,
					hoverBackgroundColor: colours
				}
			]
		};
		this.remeasure();
	}
}
