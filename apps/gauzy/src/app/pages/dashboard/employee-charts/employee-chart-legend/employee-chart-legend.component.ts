import { Component, Input } from '@angular/core';

/** One entry in {@link EmployeeChartLegendComponent}. */
export interface IEmployeeChartLegendItem {
	/** Series name, already translated. */
	label: string;
	/** Swatch colour — the same value the chart paints that series with. */
	color: string;
	/**
	 * Pre-formatted figure, shown in its own trailing column.
	 *
	 * Optional because not every chart has a number that belongs beside the
	 * series name: the stacked chart plots normalised shares, so a total printed
	 * there would not be the quantity the bar is showing.
	 */
	amount?: string;
}

/**
 * The legend for the employee-statistics charts, drawn in HTML rather than on
 * the canvas.
 *
 * Chart.js lays each legend entry out as a single run of text, so a
 * "name + figure" entry comes out ragged: four rows whose numbers each start
 * wherever the name before them happened to end. Money wants a column. Pushing
 * the figure to the trailing edge gives one — every amount ends on the same
 * right margin — and `tabular-nums` lines up the digits inside it.
 *
 * Taking the legend off the canvas also hands the plot its box back. A canvas
 * legend is measured out of the same rectangle the chart draws in, which is why
 * the doughnut needed a `maxWidth` cap to stop a long currency string pushing
 * the ring into a corner. Here the legend is a sibling of the canvas, so the two
 * divide the panel in CSS and neither can crowd the other off it.
 */
@Component({
	selector: 'ga-employee-chart-legend',
	template: `
		<ul class="legend" [class.legend--row]="orientation === 'row'">
			@for (item of items; track item.label) {
			<li class="legend-item">
				<span class="legend-swatch" [style.background-color]="item.color" aria-hidden="true"></span>
				<span class="legend-name">{{ item.label }}</span>
				@if (item.amount) {
				<span class="legend-amount">{{ item.amount }}</span>
				}
			</li>
			}
		</ul>
	`,
	styles: [
		`
			:host {
				display: block;
				min-width: 0;
			}

			.legend {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2);
			}

			/* Above a chart rather than beside it: names run inline and wrap. */
			.legend--row {
				flex-direction: row;
				flex-wrap: wrap;
				column-gap: 1rem;
			}

			.legend-item {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-width: 0;
			}

			.legend-swatch {
				flex: 0 0 auto;
				width: 0.5rem;
				height: 0.5rem;
				border-radius: 50%;
			}

			/*
			 * Ellipsis rather than a wrap: a name that folded onto a second line
			 * would put its figure on a row of its own and break the column the
			 * amounts are lining up in.
			 */
			.legend-name {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.legend-amount {
				flex: 0 0 auto;
				margin-inline-start: auto;
				padding-inline-start: 0.75rem;
				color: var(--gauzy-text-color-1);
				font-variant-numeric: tabular-nums;
			}

			/* A row legend has no column to hold: the figure just follows its name. */
			.legend--row .legend-amount {
				margin-inline-start: 0;
				padding-inline-start: 0;
			}
		`
	],
	standalone: false
})
export class EmployeeChartLegendComponent {
	/** The series to name, in the order the chart plots them. */
	@Input() items: IEmployeeChartLegendItem[] = [];

	/** 'column' beside a chart (the doughnut), 'row' above one (the bars). */
	@Input() orientation: 'column' | 'row' = 'column';
}
