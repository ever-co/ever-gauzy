import { ChartOptions, ScaleOptions, TooltipItem } from 'chart.js';
import { IEmployeeChartPalette } from './employee-chart-palette';

/**
 * Shared chrome for the three employee-statistics charts.
 *
 * The three used to each spell out their own legend, tooltip and scales, which
 * is how they drifted apart — and how the stacked chart ended up still carrying
 * Chart.js v2 option names (`legend`, `tooltips`, `elements.rectangle`,
 * `labels.fontColor`) that v4 silently ignores, so it rendered with library
 * defaults and never followed the theme at all.
 *
 * Everything here is deliberately recessive: hairline grid on the value axis
 * only, no axis borders, thin marks with rounded data-ends, and a legend of
 * small dots. The data is the only loud thing on the canvas.
 */

/** Type size for ticks and legend entries. Below the 0.75rem body caption. */
const CHART_FONT_SIZE = 11;

/** Radius on the data-end of a bar, and the surface gap between adjacent bars. */
const BAR_RADIUS = 4;
const BAR_GAP = 2;

/**
 * Legend: small circles, generous padding, text in the muted ink token.
 *
 * Always present, and never clickable-to-hide here — these series are a fixed
 * set. Its entries name every series in text beside its swatch, so identity
 * never rests on hue alone; that is the secondary encoding which lets the
 * palette's blue↔fuchsia pair sit in the validator's 6–8 CVD floor band. Do not
 * drop the legend without re-checking that palette.
 *
 * Only the horizontal bar chart still draws its legend on the canvas, with each
 * series' total appended to the dataset label. The other two render
 * `ga-employee-chart-legend` in HTML instead — same swatch-plus-name contract, so
 * the CVD note above still holds — because Chart.js cannot lay an entry out as
 * two columns and a canvas legend takes its room out of the plot's own box.
 */
export function employeeChartLegend(palette: IEmployeeChartPalette): ChartOptions<any>['plugins']['legend'] {
	return {
		display: true,
		position: 'top',
		align: 'start',
		labels: {
			color: palette.textColor,
			usePointStyle: true,
			pointStyle: 'circle',
			boxWidth: 8,
			boxHeight: 8,
			padding: 16,
			font: { size: CHART_FONT_SIZE }
		}
	};
}

/**
 * Tooltip painted as a small card on the theme's own surface, rather than
 * Chart.js's default black slab.
 *
 * @param formatValue - Formats a raw number as the organization's currency.
 */
export function employeeChartTooltip(
	palette: IEmployeeChartPalette,
	formatValue: (value: number) => string,
	/**
	 * Reads the number a hovered mark should REPORT, which is not always the
	 * number it plots. The stacked chart normalises its segments so each month's
	 * stack sums to that month's income, so its geometry is a share and its
	 * tooltip has to reach back to the unscaled figure. Defaults to the plotted
	 * value, which is the truth for the other two charts.
	 */
	resolveValue?: (item: TooltipItem<any>) => number
): ChartOptions<any>['plugins']['tooltip'] {
	return {
		enabled: true,
		backgroundColor: palette.surface,
		titleColor: palette.strongTextColor,
		bodyColor: palette.strongTextColor,
		borderColor: palette.borderColor,
		borderWidth: 1,
		cornerRadius: 6,
		padding: 10,
		displayColors: true,
		usePointStyle: true,
		boxWidth: 8,
		boxHeight: 8,
		boxPadding: 6,
		titleFont: { size: CHART_FONT_SIZE, weight: 'normal' },
		bodyFont: { size: CHART_FONT_SIZE + 1 },
		callbacks: {
			// The dataset label already carries a running total for the period, so
			// strip it back to the series name before appending THIS point's value.
			label: (item: TooltipItem<any>) => {
				const series = (item.dataset?.label ?? '').split(':')[0].trim();
				const plotted = typeof item.parsed === 'object' ? (item.parsed.x ?? item.parsed.y) : item.parsed;
				const value = resolveValue ? resolveValue(item) : Number(plotted);
				return `${series}: ${formatValue(Number(value) || 0)}`;
			}
		}
	};
}

/**
 * The axis that carries money: hairline grid, no border, abbreviated ticks.
 *
 * Ticks are abbreviated (12.5k) rather than fully formatted — a money axis
 * spelled out in full is what forces Chart.js to rotate its labels, and the
 * exact figure is one hover away.
 */
export function employeeChartValueScale(palette: IEmployeeChartPalette, stacked = false): ScaleOptions<'linear'> {
	return {
		stacked,
		border: { display: false },
		grid: {
			display: true,
			color: palette.axisLineColor,
			// Chart.js draws a tick mark outside the plot by default; the grid line
			// is the whole point, the little spur beside it is noise.
			tickLength: 0
		},
		ticks: {
			color: palette.textColor,
			font: { size: CHART_FONT_SIZE },
			padding: 8,
			maxTicksLimit: 6,
			callback: (value: number | string) => abbreviateNumber(Number(value))
		}
	} as ScaleOptions<'linear'>;
}

/**
 * The axis that carries categories (months, or the series names): no grid at
 * all. Gridlines running along the categorical axis do not help anyone read a
 * bar's length, and drawing both axes is what made these charts read as graph
 * paper.
 */
export function employeeChartCategoryScale(palette: IEmployeeChartPalette, stacked = false): ScaleOptions<'category'> {
	return {
		stacked,
		border: { display: false },
		grid: { display: false, tickLength: 0 },
		ticks: {
			color: palette.textColor,
			font: { size: CHART_FONT_SIZE },
			padding: 6,
			autoSkip: true
		}
	} as ScaleOptions<'category'>;
}

/** Mark geometry shared by both bar charts: thin, rounded, with a surface gap. */
export function employeeChartBarDataset(palette: IEmployeeChartPalette) {
	return {
		// A border painted in the SURFACE colour, which reads as a gap rather than
		// as an outline — the separation the eye needs between stacked segments and
		// between adjacent bars, without drawing chrome around every mark.
		borderWidth: BAR_GAP,
		borderColor: palette.surface,
		borderRadius: BAR_RADIUS,
		// Rounds every corner rather than only the data-end, so a stacked segment
		// is a rounded tile instead of a slab with one shaped end.
		borderSkipped: false as const,
		maxBarThickness: 18,
		// Space between the bars of one month, and between the months themselves.
		barPercentage: 0.86,
		categoryPercentage: 0.72,
		hoverBorderWidth: BAR_GAP,
		hoverBorderColor: palette.surface
	};
}

/** Chart-wide options every one of the three shares. */
export function employeeChartBase(): Partial<ChartOptions<any>> {
	return {
		responsive: true,
		// The canvas fills the height its container gives it; see `.chart-wrap`.
		maintainAspectRatio: false,
		layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
		interaction: { mode: 'nearest', intersect: true },
		animation: { duration: prefersReducedMotion() ? 0 : 300 }
	};
}

/**
 * Honours the OS "reduce motion" setting for the chart's own entrance/update
 * animation, which no CSS media query can reach.
 */
export function prefersReducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Compact axis tick: 1_250_000 -> "1.25M". Keeps a money axis to one line
 * without rotating labels.
 */
export function abbreviateNumber(value: number): string {
	if (!isFinite(value)) {
		return '';
	}
	const magnitude = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (magnitude >= 1_000_000) {
		return `${sign}${trimZeroes(magnitude / 1_000_000)}M`;
	}
	if (magnitude >= 1_000) {
		return `${sign}${trimZeroes(magnitude / 1_000)}k`;
	}
	return `${sign}${trimZeroes(magnitude)}`;
}

/** `1.50` -> `1.5`, `2.00` -> `2`. */
function trimZeroes(value: number): string {
	return String(Number(value.toFixed(2)));
}
