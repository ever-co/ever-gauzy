import { Component, ElementRef, inject, Input, OnInit } from '@angular/core';
import { NbJSThemeOptions, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChartConfiguration } from 'chart.js';
import { debounceTime, tap } from 'rxjs/operators';
import {
	IEmployeeChartPalette,
	resolveEmployeeChartPalette
} from '../../../dashboard/employee-charts/employee-chart-palette';
import {
	employeeChartBarDataset,
	employeeChartBase,
	employeeChartCategoryScale,
	employeeChartTooltip,
	employeeChartValueScale
} from '../../../dashboard/employee-charts/employee-chart-options';

/** One day of the chart: hours tracked by the timer and hours added by hand. */
export interface IEmployeeHoursDay {
	/** Axis label, already formatted for the reader (e.g. "Mon 6"). */
	label: string;
	tracked: number;
	manual: number;
}

/**
 * Hours worked per day, tracked and manual stacked.
 *
 * Painted with the same helpers and theme tokens as the HR dashboard's charts,
 * so the two pages read as one system. The legend is two swatch-and-name
 * entries in HTML above the plot, so series identity never rests on hue alone.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-employee-hours-chart',
	template: `
		<ul class="legend">
			<li><span class="swatch" [style.background-color]="palette.profit"></span>{{ trackedLabel }}</li>
			<li><span class="swatch" [style.background-color]="palette.bonus"></span>{{ manualLabel }}</li>
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
				gap: 1rem;
				margin: 0;
				padding: 0;
				list-style: none;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2);
			}
			.legend li {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
			}
			.swatch {
				width: 0.5rem;
				height: 0.5rem;
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
	standalone: false
})
export class EmployeeHoursChartComponent implements OnInit {
	@Input() trackedLabel = 'Tracked';
	@Input() manualLabel = 'Manual';

	private _days: IEmployeeHoursDay[] = [];
	@Input() set days(value: IEmployeeHoursDay[]) {
		this._days = value || [];
		this.buildData();
	}

	/** Formats an hour figure for the tooltip (e.g. 1.5 -> "1h 30m"). */
	@Input() formatHours: (hours: number) => string = (hours) => `${hours}h`;

	public palette: IEmployeeChartPalette = resolveEmployeeChartPalette({} as NbJSThemeOptions);
	public data: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
	public options: ChartConfiguration<'bar'>['options'];

	private readonly _themeService = inject(NbThemeService);
	private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);

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
		const valueScale = employeeChartValueScale(this.palette, true);
		this.options = {
			...employeeChartBase(),
			interaction: { mode: 'index', intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: employeeChartTooltip(this.palette, (value) => this.formatHours(value))
			},
			scales: {
				x: employeeChartCategoryScale(this.palette, true) as any,
				y: {
					...valueScale,
					beginAtZero: true,
					ticks: { ...(valueScale as any).ticks, callback: (value: number | string) => `${value}h` }
				} as any
			}
		};
	}

	private buildData(): void {
		const bar = employeeChartBarDataset(this.palette);
		this.data = {
			labels: this._days.map((day) => day.label),
			datasets: [
				{
					...bar,
					label: this.trackedLabel,
					data: this._days.map((day) => day.tracked),
					backgroundColor: this.palette.profit,
					hoverBackgroundColor: this.palette.profit
				},
				{
					...bar,
					label: this.manualLabel,
					data: this._days.map((day) => day.manual),
					backgroundColor: this.palette.bonus,
					hoverBackgroundColor: this.palette.bonus
				}
			]
		};
	}
}
