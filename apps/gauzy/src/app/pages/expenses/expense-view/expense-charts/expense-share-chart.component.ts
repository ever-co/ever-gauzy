import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnInit, signal } from '@angular/core';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, TooltipItem } from 'chart.js';
import { debounceTime, tap } from 'rxjs/operators';
import {
	IEmployeeChartPalette,
	resolveEmployeeChartPalette
} from '../../../dashboard/employee-charts/employee-chart-palette';
import { employeeChartBase, employeeChartTooltip } from '../../../dashboard/employee-charts/employee-chart-options';
import { IExpenseMonthShare } from '../expense-view-charts';

/**
 * The expense's share of its month as a ring: the expense in the expenses colour, the rest of the month in a
 * neutral one, and the share written in the middle. The legend under it gives both amounts, so the figures never
 * rest on the ring alone.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-share-chart',
	template: `
		<div class="ring">
			<!-- The ring is drawn for the eye; its share is the figure in the middle, its amounts the legend under it. -->
			<canvas baseChart type="doughnut" [data]="data()" [options]="options()" aria-hidden="true"></canvas>
			<span class="ring-figure">{{ percentText() }}</span>
		</div>
		<ul class="legend">
			<li>
				<span class="swatch" [style.background-color]="palette()[accent()]"></span>
				<span class="legend-name">{{ amountLabel() }}</span>
				<strong>{{ formatValue()(share()?.amount ?? 0) }}</strong>
			</li>
			<li>
				<span class="swatch" [style.background-color]="palette().axisLineColor"></span>
				<span class="legend-name">{{ restLabel() }}</span>
				<strong>{{ formatValue()(share()?.rest ?? 0) }}</strong>
			</li>
			<li class="legend-total">
				<span class="legend-name">{{ totalLabel() }}</span>
				<strong>{{ formatValue()(share()?.total ?? 0) }}</strong>
			</li>
		</ul>
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				align-items: stretch;
				gap: 0.75rem;
			}
			/* Chart.js sizes the canvas from its positioned parent. */
			.ring {
				position: relative;
				width: 8.5rem;
				height: 8.5rem;
				align-self: center;
			}
			.ring-figure {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 1.125rem;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
				color: var(--gauzy-text-color-1);
				pointer-events: none;
			}
			.legend {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}
			/* Sized on the item itself: a global rule sets every li to 14px. */
			.legend li {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-2);
			}
			.legend strong {
				margin-inline-start: auto;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
				color: var(--gauzy-text-color-1);
			}
			.legend-name {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.legend-total {
				padding-top: 0.375rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.2));
			}
			.swatch {
				flex: 0 0 auto;
				width: 0.4375rem;
				height: 0.4375rem;
				border-radius: 50%;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [BaseChartDirective]
})
export class ExpenseShareChartComponent implements OnInit {
	readonly share = input<IExpenseMonthShare | null>(null);

	readonly amountLabel = input('');
	readonly restLabel = input('');
	readonly totalLabel = input('');

	/** Formats an amount, in the expense's currency. */
	readonly formatValue = input<(value: number) => string>((value) => String(value));

	/** The colour of the record's own arc: the expenses colour, or the revenue one on the income page. */
	readonly accent = input<'expenses' | 'revenue'>('expenses');

	/** The theme's colours, and the options built from them: both set again on every theme change. */
	readonly palette = signal<IEmployeeChartPalette>(resolveEmployeeChartPalette({} as NbJSThemeOptions));
	readonly options = signal<ChartConfiguration<'doughnut'>['options']>(undefined);

	/** The share in the middle of the ring, e.g. "42%". */
	readonly percentText = computed(() => {
		const percent = this.share()?.percent ?? 0;
		return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
	});

	readonly data = computed<ChartConfiguration<'doughnut'>['data']>(() => {
		const share = this.share();
		const palette = this.palette();
		const colours = [palette[this.accent()], palette.axisLineColor];
		return {
			labels: [this.amountLabel(), this.restLabel()],
			datasets: [
				{
					data: share ? [share.amount, share.rest] : [],
					backgroundColor: colours,
					hoverBackgroundColor: colours,
					// The surface colour between the two arcs reads as a gap, as the bar charts' borders do.
					borderColor: palette.surface,
					borderWidth: 2,
					hoverBorderColor: palette.surface
				}
			]
		};
	});

	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	ngOnInit(): void {
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

	/** The tooltip reads the format as it opens: the options follow the theme only. */
	private buildOptions(palette: IEmployeeChartPalette): ChartConfiguration<'doughnut'>['options'] {
		const tooltip = employeeChartTooltip(palette, (value) => this.formatValue()(value));
		return {
			...employeeChartBase(),
			cutout: '72%',
			layout: { padding: 0 },
			plugins: {
				legend: { display: false },
				tooltip: {
					...tooltip,
					callbacks: {
						title: () => '',
						label: (item: TooltipItem<'doughnut'>) =>
							`${item.label}: ${this.formatValue()(Number(item.parsed) || 0)}`
					}
				}
			}
		};
	}
}
