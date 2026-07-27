import { CurrencyPipe } from '@angular/common';
import { ChartConfiguration, ChartType, TooltipItem } from 'chart.js';
import { CurrencyPosition, IMonthAggregatedEmployeeStatistics, IOrganization } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { months } from '@gauzy/ui-core/core';
import { CurrencyPositionPipe } from '../../../pipes/currency-position.pipe';

/**
 * The three renderings of the monthly employee statistics offered by the legacy
 * `<ga-employee-charts>` switcher on the HR dashboard.
 *
 * The string values are persisted inside a placement's `config` (the switcher
 * widget stores the user's pick under `chartType`), so treat them as a data
 * contract: renaming one resets every saved switcher to its default.
 */
export enum EmployeeChartKind {
	DOUGHNUT = 'doughnut',
	HORIZONTAL_BAR = 'horizontal-bar',
	STACKED_BAR = 'stacked-bar'
}

/** Ordered list backing the switcher widget's dropdown. */
export const EMPLOYEE_CHART_KINDS: readonly EmployeeChartKind[] = [
	EmployeeChartKind.HORIZONTAL_BAR,
	EmployeeChartKind.DOUGHNUT,
	EmployeeChartKind.STACKED_BAR
];

/**
 * Configuration key holding the rendering a switcher placement opens on.
 *
 * Declared here rather than next to the component so the widget registry can
 * reference it without eagerly importing the component — which would defeat the
 * registry entry's own `loadComponent` lazy import.
 */
export const EMPLOYEE_CHART_TYPE_CONFIG_KEY = 'chartType';

/** Translation key of each chart kind, matching the legacy switcher's labels. */
export const EMPLOYEE_CHART_KIND_LABELS: Readonly<Record<EmployeeChartKind, string>> = {
	[EmployeeChartKind.HORIZONTAL_BAR]: 'DASHBOARD_PAGE.CHARTS.BAR',
	[EmployeeChartKind.DOUGHNUT]: 'DASHBOARD_PAGE.CHARTS.DOUGHNUT',
	[EmployeeChartKind.STACKED_BAR]: 'DASHBOARD_PAGE.CHARTS.STACKED_BAR'
};

/**
 * Colours a chart needs, resolved from the ACTIVE theme rather than hardcoded.
 *
 * The legacy charts baked six literal hex values into the component, so they
 * rendered identically (and, on the dark themes, badly) whatever theme the user
 * had picked. Everything here comes from the Nebular JS theme instead, which is
 * the canvas equivalent of `nb-theme()` — a `<canvas>` cannot resolve a CSS
 * custom property, so the value has to be looked up in TypeScript.
 */
export interface IEmployeeChartPalette {
	revenue: string;
	expenses: string;
	bonus: string;
	profit: string;
	/** Bonus bars below zero, so a negative reads as a loss at a glance. */
	negativeBonus: string;
	/** Profit bars below zero. */
	negativeProfit: string;
	/** Legend / tick label colour. */
	textColor: string;
	/** Grid line colour. */
	axisLineColor: string;
}

/**
 * How each palette slot is resolved, in order of preference.
 *
 * 1. `themeVariable` — the Nebular JS theme (`NbThemeService.getJsTheme()`),
 *    which every one of the shipped themes defines.
 * 2. `cssVariable` — the matching CSS custom property, read off the widget's own
 *    host element, for a theme that only declares the SCSS side.
 * 3. `fallback` — a CSS *named* colour. Deliberately not a hex literal: nothing
 *    here should ever look like a value copied out of a design file, and a named
 *    colour makes it obvious in review that the theme lookup failed.
 */
interface ChartColorToken {
	readonly themeVariable: string;
	readonly cssVariable: string;
	readonly fallback: string;
}

const CHART_COLOR_TOKENS: Readonly<
	Record<keyof Omit<IEmployeeChartPalette, 'textColor' | 'axisLineColor'>, ChartColorToken>
> = {
	revenue: { themeVariable: 'success', cssVariable: '--color-success-default', fallback: 'green' },
	expenses: { themeVariable: 'warning', cssVariable: '--color-warning-default', fallback: 'gold' },
	bonus: { themeVariable: 'info', cssVariable: '--color-info-default', fallback: 'blue' },
	profit: { themeVariable: 'successLight', cssVariable: '--color-success-300', fallback: 'lime' },
	negativeBonus: { themeVariable: 'danger', cssVariable: '--color-danger-default', fallback: 'red' },
	negativeProfit: { themeVariable: 'dangerLight', cssVariable: '--color-danger-300', fallback: 'orange' }
};

const TEXT_COLOR_TOKEN: ChartColorToken = {
	themeVariable: 'fgText',
	cssVariable: '--text-basic-color',
	fallback: 'gray'
};

const AXIS_LINE_COLOR_TOKEN: ChartColorToken = {
	themeVariable: 'separator',
	cssVariable: '--border-basic-color-3',
	fallback: 'silver'
};

/** Shape of the slice of `NbJSThemeOptions.variables` the charts read. */
type ThemeVariables = Record<string, unknown> | undefined | null;

/**
 * Resolves the chart palette for the currently active theme.
 *
 * @param variables - `NbJSThemeOptions.variables` of the active theme.
 * @param element - The widget's host element, used to read CSS custom properties
 *                  when the JS theme does not declare a variable.
 * @returns A fully populated palette; never throws and never returns an empty colour.
 */
export function resolveEmployeeChartPalette(
	variables: ThemeVariables,
	element?: Element | null
): IEmployeeChartPalette {
	// `chartjs` is the block every Gauzy theme declares for Chart.js specifically;
	// preferring it keeps these widgets consistent with the report line chart.
	const chartJs = (variables?.['chartjs'] ?? {}) as { textColor?: string; axisLineColor?: string };

	return {
		revenue: resolveColor(CHART_COLOR_TOKENS.revenue, variables, element),
		expenses: resolveColor(CHART_COLOR_TOKENS.expenses, variables, element),
		bonus: resolveColor(CHART_COLOR_TOKENS.bonus, variables, element),
		profit: resolveColor(CHART_COLOR_TOKENS.profit, variables, element),
		negativeBonus: resolveColor(CHART_COLOR_TOKENS.negativeBonus, variables, element),
		negativeProfit: resolveColor(CHART_COLOR_TOKENS.negativeProfit, variables, element),
		textColor: chartJs.textColor || resolveColor(TEXT_COLOR_TOKEN, variables, element),
		axisLineColor: chartJs.axisLineColor || resolveColor(AXIS_LINE_COLOR_TOKEN, variables, element)
	};
}

/**
 * Resolves one palette slot through the three-step chain documented on
 * {@link CHART_COLOR_TOKENS}.
 *
 * @param token - The slot to resolve.
 * @param variables - The active theme's JS variables.
 * @param element - Host element for the CSS custom property lookup.
 * @returns A non-empty CSS colour string.
 */
function resolveColor(token: ChartColorToken, variables: ThemeVariables, element?: Element | null): string {
	const themed = variables?.[token.themeVariable];
	if (typeof themed === 'string' && themed.trim()) {
		return themed.trim();
	}

	const fromCss = readCssVariable(token.cssVariable, element);
	return fromCss || token.fallback;
}

/**
 * Reads a CSS custom property off an element.
 *
 * Guarded for non-browser platforms (SSR, unit tests) where `getComputedStyle`
 * does not exist — a widget must degrade to its fallback colour, not crash.
 *
 * @param name - The custom property name, including the leading `--`.
 * @param element - Element to resolve against; falls back to the document root.
 * @returns The trimmed value, or an empty string when it cannot be read.
 */
function readCssVariable(name: string, element?: Element | null): string {
	if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
		return '';
	}

	const target = element ?? (typeof document !== 'undefined' ? document.documentElement : null);
	if (!target) {
		return '';
	}

	try {
		return window.getComputedStyle(target).getPropertyValue(name).trim();
	} catch {
		return '';
	}
}

/** The four money series every employee chart is built from. */
export interface IEmployeeStatisticsTotals {
	income: number;
	expense: number;
	profit: number;
	bonus: number;
}

/**
 * Sums the monthly rows into one total per series.
 *
 * The legacy doughnut read `employeeStatistics[0]` — correct on the HR page,
 * whose date picker is locked to a single month, but wrong on a canvas where the
 * range is free: a quarter would have silently charted only its first month.
 * Summing matches how the HR page itself totals the same payload for its KPI
 * blocks (`HumanResourcesComponent._statsSum`).
 *
 * @param statistics - Monthly aggregated rows, newest-first or oldest-first.
 * @returns The totals; all zeros for an empty/absent payload.
 */
export function sumEmployeeStatistics(
	statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined
): IEmployeeStatisticsTotals {
	return toRows(statistics).reduce<IEmployeeStatisticsTotals>(
		(totals, statistic) => ({
			income: totals.income + toNumber(statistic?.income),
			expense: totals.expense + toNumber(statistic?.expense),
			profit: totals.profit + toNumber(statistic?.profit),
			bonus: totals.bonus + toNumber(statistic?.bonus)
		}),
		{ income: 0, expense: 0, profit: 0, bonus: 0 }
	);
}

/**
 * Narrows a payload to the rows the builders can iterate.
 *
 * `?? []` alone only covers `null`/`undefined`: a proxy or a misbehaving
 * endpoint answering `200` with an object would reach `.map()`/`.reduce()` and
 * throw INSIDE a computed, i.e. while Angular renders the widget — which takes
 * the whole canvas down instead of showing the card's error state.
 *
 * @param statistics - Whatever came back from the statistics endpoint.
 * @returns The rows, or an empty array when the payload is not a list.
 */
function toRows(
	statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined
): readonly IMonthAggregatedEmployeeStatistics[] {
	return Array.isArray(statistics) ? statistics : [];
}

/**
 * Coerces an API value that should be numeric.
 *
 * The statistics endpoint returns aggregates that arrive as strings from some
 * database drivers, and `undefined + 1` would poison every downstream total
 * with `NaN` — which Chart.js renders as an empty chart with no explanation.
 *
 * @param value - The raw value.
 * @returns A finite number; `0` when the value cannot be interpreted.
 */
function toNumber(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Month/year labels for the categorical axis, e.g. `Mar '25`.
 *
 * Uses moment's localized month names (the same `months` export the legacy bar
 * chart used) and the API's zero-based `month`.
 *
 * @param statistics - Monthly aggregated rows.
 * @returns One label per row, in payload order.
 */
export function toMonthLabels(statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined): string[] {
	return toRows(statistics).map((statistic) => {
		const name = months[statistic?.month] ?? '';
		const year = `${statistic?.year ?? ''}`;
		return `${name} '${year.slice(-2)}`;
	});
}

/**
 * Formats a money value the way the rest of the dashboard does.
 *
 * Deliberately takes the two pipes as arguments instead of importing them as
 * singletons: `CurrencyPipe` is locale-bound and must come from the component's
 * own injector.
 *
 * @param value - The amount.
 * @param organization - Organization owning the currency + its position.
 * @param currencyPipe - Angular's currency pipe.
 * @param positionPipe - Gauzy's symbol-position pipe.
 * @returns The formatted amount; falls back to the raw currency string when the
 *          position pipe cannot parse it.
 */
export function formatEmployeeCurrency(
	value: number,
	organization: IOrganization | undefined,
	currencyPipe: CurrencyPipe,
	positionPipe: CurrencyPositionPipe
): string {
	let currency: string;
	try {
		currency = currencyPipe.transform(value ?? 0, organization?.currency || environment.DEFAULT_CURRENCY) ?? '';
	} catch {
		// `Intl.NumberFormat` throws a `RangeError` on a currency code it does not
		// know, and an organization's currency is data, not a constant. The bare
		// amount is still readable; a legend that throws would blank the chart.
		return `${value ?? 0}`;
	}

	try {
		// `CurrencyPositionPipe.extract()` indexes the result of `RegExp.exec()`
		// without a null check, so a formatted value carrying no symbol at all
		// (some locale/currency-code combinations) throws. The plain formatted
		// string is still perfectly readable, so never let this break the chart.
		return positionPipe.transform(currency, organization?.currencyPosition || CurrencyPosition.LEFT);
	} catch {
		return currency;
	}
}

/** Chart.js chart type backing each {@link EmployeeChartKind}. */
export function toChartType(kind: EmployeeChartKind): ChartType {
	return kind === EmployeeChartKind.DOUGHNUT ? 'doughnut' : 'bar';
}

/**
 * Narrows an arbitrary persisted value to a known chart kind.
 *
 * @param value - Raw value out of the placement's `config`.
 * @param fallback - Kind to use when the value is absent or unknown.
 * @returns A valid {@link EmployeeChartKind}.
 */
export function toEmployeeChartKind(
	value: unknown,
	fallback: EmployeeChartKind = EmployeeChartKind.HORIZONTAL_BAR
): EmployeeChartKind {
	return EMPLOYEE_CHART_KINDS.includes(value as EmployeeChartKind) ? (value as EmployeeChartKind) : fallback;
}

/** Everything the dataset/label builders need beyond the raw statistics. */
export interface IEmployeeChartContext {
	palette: IEmployeeChartPalette;
	/** Already translated series names, keyed by series. */
	labels: {
		revenue: string;
		expenses: string;
		profit: string;
		bonus: string;
	};
	/** Formats an amount for the legend labels. */
	formatCurrency: (value: number) => string;
}

/**
 * Doughnut dataset: one slice per money series over the whole selected range.
 *
 * @param statistics - Monthly aggregated rows.
 * @param context - Palette, translated series names and the currency formatter.
 * @returns A Chart.js data object.
 */
export function buildDoughnutChartData(
	statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined,
	context: IEmployeeChartContext
): ChartConfiguration['data'] {
	const totals = sumEmployeeStatistics(statistics);
	const { palette, labels, formatCurrency } = context;

	return {
		// The amount lives in the legend label, exactly like the legacy doughnut:
		// a slice is unreadable without it, and the tooltip echoes the same string.
		labels: [
			`${labels.revenue}: ${formatCurrency(totals.income)}`,
			`${labels.expenses}: ${formatCurrency(totals.expense)}`,
			`${labels.bonus}: ${formatCurrency(totals.bonus)}`,
			`${labels.profit}: ${formatCurrency(totals.profit)}`
		],
		datasets: [
			{
				data: [totals.income, totals.expense, totals.bonus, totals.profit],
				backgroundColor: [palette.revenue, palette.expenses, palette.bonus, palette.profit],
				hoverBorderColor: 'transparent',
				borderWidth: 1
			}
		]
	};
}

/**
 * Grouped horizontal bar dataset: four series across the months in range.
 *
 * @param statistics - Monthly aggregated rows.
 * @param context - Palette, translated series names and the currency formatter.
 * @returns A Chart.js data object.
 */
export function buildHorizontalBarChartData(
	statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined,
	context: IEmployeeChartContext
): ChartConfiguration['data'] {
	const rows = toRows(statistics);
	const { palette, labels, formatCurrency } = context;

	const income = rows.map((row) => toNumber(row?.income));
	const expense = rows.map((row) => toNumber(row?.expense));
	const profit = rows.map((row) => toNumber(row?.profit));
	const bonus = rows.map((row) => toNumber(row?.bonus));
	const totals = sumEmployeeStatistics(rows);

	return {
		labels: toMonthLabels(rows),
		datasets: [
			{
				label: `${labels.revenue}: ${formatCurrency(totals.income)}`,
				backgroundColor: palette.revenue,
				data: income,
				borderWidth: 0
			},
			{
				label: `${labels.expenses}: ${formatCurrency(totals.expense)}`,
				backgroundColor: palette.expenses,
				data: expense,
				borderWidth: 0
			},
			{
				label: `${labels.profit}: ${formatCurrency(totals.profit)}`,
				// Per-bar colours: a loss must not be the same green as a gain.
				backgroundColor: profit.map((value) => (value < 0 ? palette.negativeProfit : palette.profit)),
				data: profit,
				borderWidth: 0
			},
			{
				label: `${labels.bonus}: ${formatCurrency(totals.bonus)}`,
				backgroundColor: bonus.map((value) => (value < 0 ? palette.negativeBonus : palette.bonus)),
				data: bonus,
				borderWidth: 0
			}
		]
	};
}

/**
 * Stacked horizontal bar dataset.
 *
 * Each month's expense/bonus/profit are divided by that month's
 * `(expense + profit + bonus) / income` proportion, so the stack length is
 * comparable to the month's income rather than to the other months — the exact
 * normalization the legacy stacked chart applied.
 *
 * @param statistics - Monthly aggregated rows.
 * @param context - Palette, translated series names and the currency formatter.
 * @returns A Chart.js data object.
 */
export function buildStackedBarChartData(
	statistics: readonly IMonthAggregatedEmployeeStatistics[] | null | undefined,
	context: IEmployeeChartContext
): ChartConfiguration['data'] {
	const rows = toRows(statistics);
	const { palette, labels } = context;

	const expense: number[] = [];
	const bonus: number[] = [];
	const profit: number[] = [];

	for (const row of rows) {
		const proportion = toProportion(row);
		expense.push(round2(toNumber(row?.expense) / proportion));
		bonus.push(round2(toNumber(row?.bonus) / proportion));
		profit.push(round2(toNumber(row?.profit) / proportion));
	}

	return {
		labels: toMonthLabels(rows),
		datasets: [
			{
				label: labels.expenses,
				backgroundColor: palette.expenses,
				data: expense,
				borderWidth: 0
			},
			{
				label: labels.bonus,
				backgroundColor: bonus.map((value) => (value < 0 ? palette.negativeBonus : palette.bonus)),
				data: bonus,
				borderWidth: 0
			},
			{
				label: labels.profit,
				backgroundColor: profit.map((value) => (value < 0 ? palette.negativeProfit : palette.profit)),
				data: profit,
				borderWidth: 0
			}
		]
	};
}

/**
 * Normalization factor of one month's stack.
 *
 * Guarded against `0` and non-finite results: the legacy `|| 1` only caught
 * `NaN` from a zero income, and a proportion of exactly `0` (a month with no
 * expense, profit or bonus) would have produced `Infinity` bars.
 *
 * @param statistic - One monthly row.
 * @returns A safe, non-zero divisor.
 */
function toProportion(statistic: IMonthAggregatedEmployeeStatistics | undefined): number {
	const income = toNumber(statistic?.income);
	if (income === 0) {
		return 1;
	}

	const stacked = toNumber(statistic?.expense) + toNumber(statistic?.profit) + toNumber(statistic?.bonus);
	const proportion = stacked / income;
	return Number.isFinite(proportion) && proportion !== 0 ? proportion : 1;
}

/** Rounds to two decimals, the precision the legacy stacked chart used. */
function round2(value: number): number {
	return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

/**
 * Doughnut options.
 *
 * @param palette - Theme colours for legend text.
 * @returns Chart.js options.
 */
export function buildDoughnutChartOptions(palette: IEmployeeChartPalette): ChartConfiguration['options'] {
	return {
		responsive: true,
		// Required: the widget's grid cell dictates the height, so the chart must
		// not try to hold on to a fixed aspect ratio.
		maintainAspectRatio: false,
		elements: {
			arc: {
				borderWidth: 2
			}
		},
		plugins: {
			legend: {
				position: 'top',
				labels: {
					color: palette.textColor,
					usePointStyle: false
				}
			},
			tooltip: {
				enabled: true,
				callbacks: {
					// The slice label already carries "<series>: <amount>".
					title: () => '',
					label: (item: TooltipItem<ChartType>) => item.label ?? ''
				}
			}
		}
	};
}

/**
 * Grouped horizontal bar options.
 *
 * @param palette - Theme colours for legend, ticks and grid lines.
 * @returns Chart.js options.
 */
export function buildHorizontalBarChartOptions(palette: IEmployeeChartPalette): ChartConfiguration['options'] {
	return {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		elements: {
			bar: {
				borderWidth: 2
			}
		},
		plugins: {
			legend: {
				position: 'top',
				labels: {
					color: palette.textColor,
					usePointStyle: false
				}
			},
			tooltip: {
				enabled: true,
				callbacks: {
					title: () => ''
				}
			}
		},
		// Inlined rather than shared with the stacked builder: `scales` is typed as
		// a deep partial over a union of every registered scale type, and a helper's
		// inferred return type does not reliably narrow into it.
		scales: {
			x: {
				stacked: false,
				grid: { display: true, color: palette.axisLineColor },
				ticks: { color: palette.textColor }
			},
			y: {
				stacked: false,
				grid: { display: true, color: palette.axisLineColor },
				ticks: { color: palette.textColor }
			}
		}
	};
}

/**
 * Stacked horizontal bar options.
 *
 * Takes the statistics as well as the palette so the tooltip can UNDO the
 * per-month normalization {@link buildStackedBarChartData} applies: the plotted
 * value is a proportion-scaled number that is not a real amount, so a default
 * tooltip would report money the employee never earned or spent. (The legacy
 * chart tried the same and coerced a whole array with `+`, so its tooltip read
 * `NaN` for any range longer than one month.)
 *
 * @param palette - Theme colours for legend, ticks and grid lines.
 * @param statistics - The rows the datasets were built from, in the same order.
 * @param formatCurrency - Formats the real amount; falls back to the plain number.
 * @returns Chart.js options.
 */
export function buildStackedBarChartOptions(
	palette: IEmployeeChartPalette,
	statistics?: readonly IMonthAggregatedEmployeeStatistics[] | null,
	formatCurrency?: (value: number) => string
): ChartConfiguration['options'] {
	// One divisor per month, indexed exactly like the datasets' `data` arrays.
	const proportions = toRows(statistics).map((statistic) => toProportion(statistic));
	const format = formatCurrency ?? ((value: number) => `${value}`);

	return {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		elements: {
			bar: {
				borderWidth: 2
			}
		},
		plugins: {
			legend: {
				// The legacy chart put this legend on the right and swallowed its
				// click handler; keeping it on top matches the sibling charts and
				// leaves the series toggles working.
				position: 'top',
				labels: {
					color: palette.textColor,
					usePointStyle: false
				}
			},
			tooltip: {
				enabled: true,
				callbacks: {
					label: (item: TooltipItem<ChartType>) => {
						const proportion = proportions[item.dataIndex] ?? 1;
						const amount = round2(toNumber(item.raw) * proportion);
						const label = item.dataset?.label ?? '';
						return label ? `${label}: ${format(amount)}` : format(amount);
					}
				}
			}
		},
		scales: {
			x: {
				stacked: true,
				grid: { display: true, color: palette.axisLineColor },
				ticks: { color: palette.textColor }
			},
			y: {
				stacked: true,
				grid: { display: true, color: palette.axisLineColor },
				ticks: { color: palette.textColor }
			}
		}
	};
}
