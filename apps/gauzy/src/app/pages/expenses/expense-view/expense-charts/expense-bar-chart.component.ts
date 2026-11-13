import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	OnInit,
	signal,
	viewChild
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

/** How the amounts are drawn: as bars, or as points on a line that shows the trend. */
export type ExpenseChartKind = 'bar' | 'line';

/**
 * Amounts as bars, the expense's own bar in the expenses colour and the others in a second hue, so the expense
 * stands out among them. Painted with the dashboard's chart helpers and theme tokens, like the employee and task
 * pages' hours charts; the legend is HTML above the plot, so which bar is which never rests on hue alone.
 *
 * As a line (`kind="line"`), the same amounts are points joined in the second hue, the expense's own point larger
 * and in the highlight colour: the legend reads the same either way.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-bar-chart',
	template: `
		<ul class="legend">
			<li><span class="swatch" [style.background-color]="palette()[accent()]"></span>{{ highlightLabel() }}</li>
			<li><span class="swatch" [style.background-color]="palette().bonus"></span>{{ otherLabel() }}</li>
		</ul>
		<div class="canvas" aria-hidden="true">
			<canvas baseChart [type]="kind()" [data]="data()" [options]="options()"></canvas>
		</div>
		<!-- The figures the bars draw, for a screen reader: the canvas and its tooltips are pointer-only. -->
		<ul class="visually-hidden">
			@for (bar of bars(); track $index) {
				<li>{{ bar.title }}: {{ formatValue()(bar.value) }}{{ bar.highlight ? ' (' + highlightLabel() + ')' : '' }}</li>
			}
		</ul>
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
			.visually-hidden {
				position: absolute;
				width: 1px;
				height: 1px;
				margin: -1px;
				padding: 0;
				overflow: hidden;
				clip: rect(0 0 0 0);
				white-space: nowrap;
				border: 0;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [BaseChartDirective]
})
export class ExpenseBarChartComponent implements OnInit, AfterViewInit, OnDestroy {
	readonly bars = input<IExpenseChartBar[], IExpenseChartBar[] | null | undefined>([], {
		transform: (value) => value || []
	});

	/** The legend's name for the expense's own bar. */
	readonly highlightLabel = input('');
	/** The legend's name for the other bars. */
	readonly otherLabel = input('');

	/** Formats an amount for the tooltip, in the expense's currency. */
	readonly formatValue = input<(value: number) => string>((value) => String(value));

	/** The chart colour of the highlighted bar: the expenses colour, or the revenue one on the income page. */
	readonly accent = input<'expenses' | 'revenue'>('expenses');

	/** Bars (the default), or a line through the same amounts. Changing it draws the chart anew. */
	readonly kind = input<ExpenseChartKind>('bar');

	/** The theme's colours, and the options built from them: both set again on every theme change. */
	readonly palette = signal<IEmployeeChartPalette>(resolveEmployeeChartPalette({} as NbJSThemeOptions));
	readonly options = signal<ChartConfiguration<ExpenseChartKind>['options']>(undefined);

	readonly data = computed<ChartConfiguration<ExpenseChartKind>['data']>(() => {
		const bars = this.bars();
		const palette = this.palette();
		const highlight = palette[this.accent()];
		const colours = bars.map((bar) => (bar.highlight ? highlight : palette.bonus));
		const values = bars.map((bar) => bar.value);
		const labels = bars.map((bar) => bar.label);
		if (this.kind() === 'line') {
			return {
				labels,
				datasets: [
					{
						type: 'line' as const,
						data: values,
						borderColor: palette.bonus,
						borderWidth: 2,
						tension: 0.3,
						fill: false,
						// The highlighted point is the one to find: larger, and in the highlight colour.
						pointRadius: bars.map((bar) => (bar.highlight ? 5 : 3)),
						pointHoverRadius: bars.map((bar) => (bar.highlight ? 7 : 5)),
						pointBackgroundColor: colours,
						pointHoverBackgroundColor: colours,
						pointBorderColor: palette.surface,
						pointHoverBorderColor: palette.surface,
						pointBorderWidth: 2
					}
				]
			};
		}
		return {
			labels,
			datasets: [
				{
					type: 'bar' as const,
					...employeeChartBarDataset(palette),
					data: values,
					backgroundColor: colours,
					hoverBackgroundColor: colours
				}
			]
		};
	});

	private readonly _chart = viewChild(BaseChartDirective);

	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	/** Chart.js measures its box once; the panel settles after that, so the chart re-measures with it. */
	private readonly _resizeObserver =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.remeasure()) : null;

	/** Axis tick size: a step below the legend, so the data reads first. */
	private static readonly TICK_FONT = { size: 10 };

	constructor() {
		// New bars can change the axis' width: the chart re-measures with each.
		effect(() => {
			this.data();
			this.remeasure();
		});
	}

	ngOnInit(): void {
		this._resizeObserver?.observe(this._elementRef.nativeElement);
		this._themeService
			.getJsTheme()
			.pipe(
				debounceTime(100),
				tap((config: NbJSThemeOptions) => {
					const palette = resolveEmployeeChartPalette(config, this._elementRef.nativeElement);
					this.palette.set(palette);
					this.options.set(this.buildOptions(palette));
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
		requestAnimationFrame(() => this._chart()?.chart?.resize());
	}

	/** The tooltip reads the bars, the labels and the format as it opens: the options follow the theme only. */
	private buildOptions(palette: IEmployeeChartPalette): ChartConfiguration<ExpenseChartKind>['options'] {
		const valueScale = employeeChartValueScale(palette);
		const categoryScale = employeeChartCategoryScale(palette);
		const tooltip = employeeChartTooltip(palette, (value) => this.formatValue()(value));
		return {
			...employeeChartBase(),
			interaction: { mode: 'index', intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: {
					...tooltip,
					callbacks: {
						...tooltip.callbacks,
						// The full date or month, where the axis has room only for a short one.
						title: (items: TooltipItem<ExpenseChartKind>[]) => this.bars()[items[0]?.dataIndex]?.title ?? '',
						// One dataset carries both kinds of bar, so the series name comes from the bar itself.
						label: (item: TooltipItem<ExpenseChartKind>) => {
							const series = this.bars()[item.dataIndex]?.highlight ? this.highlightLabel() : this.otherLabel();
							return `${series}: ${this.formatValue()(Number(item.parsed?.y) || 0)}`;
						}
					}
				}
			},
			scales: {
				x: {
					...categoryScale,
					// Half a step at each end, as bars have: a line's first and last points are not cut at the edges.
					offset: true,
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
}
