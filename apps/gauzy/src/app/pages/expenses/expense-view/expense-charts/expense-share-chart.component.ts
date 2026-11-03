import { ChangeDetectionStrategy, Component, ElementRef, inject, Input, OnInit } from '@angular/core';
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
			<canvas baseChart type="doughnut" [data]="data" [options]="options"></canvas>
			<span class="ring-figure" aria-hidden="true">{{ percentText }}</span>
		</div>
		<ul class="legend">
			<li>
				<span class="swatch" [style.background-color]="palette.expenses"></span>
				<span class="legend-name">{{ amountLabel }}</span>
				<strong>{{ formatValue(share?.amount ?? 0) }}</strong>
			</li>
			<li>
				<span class="swatch" [style.background-color]="palette.axisLineColor"></span>
				<span class="legend-name">{{ restLabel }}</span>
				<strong>{{ formatValue(share?.rest ?? 0) }}</strong>
			</li>
			<li class="legend-total">
				<span class="legend-name">{{ totalLabel }}</span>
				<strong>{{ formatValue(share?.total ?? 0) }}</strong>
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
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: true,
	imports: [BaseChartDirective]
})
export class ExpenseShareChartComponent implements OnInit {
	private _share: IExpenseMonthShare | null = null;
	@Input() set share(value: IExpenseMonthShare | null) {
		this._share = value;
		this.buildData();
	}
	get share(): IExpenseMonthShare | null {
		return this._share;
	}

	@Input() amountLabel = '';
	@Input() restLabel = '';
	@Input() totalLabel = '';

	/** Formats an amount, in the expense's currency. */
	@Input() formatValue: (value: number) => string = (value) => String(value);

	public palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);
	public data: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
	public options: ChartConfiguration<'doughnut'>['options'];

	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

	/** The share in the middle of the ring, e.g. "42%". */
	get percentText(): string {
		const percent = this._share?.percent ?? 0;
		return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
	}

	ngOnInit(): void {
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

	private buildOptions(): void {
		const tooltip = employeeChartTooltip(this.palette, (value) => this.formatValue(value)) as any;
		this.options = {
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
							`${item.label}: ${this.formatValue(Number(item.parsed) || 0)}`
					}
				}
			}
		};
	}

	private buildData(): void {
		const share = this._share;
		const colours = [this.palette.expenses, this.palette.axisLineColor];
		this.data = {
			labels: [this.amountLabel, this.restLabel],
			datasets: [
				{
					data: share ? [share.amount, share.rest] : [],
					backgroundColor: colours,
					hoverBackgroundColor: colours,
					// The surface colour between the two arcs reads as a gap, as the bar charts' borders do.
					borderColor: this.palette.surface,
					borderWidth: 2,
					hoverBorderColor: this.palette.surface
				}
			]
		};
	}
}
