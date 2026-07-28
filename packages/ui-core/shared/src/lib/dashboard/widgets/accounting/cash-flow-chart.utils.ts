import { IChartEmployeeStatistic } from '@gauzy/contracts';
import { ChartUtil } from '../../../report/charts/line-chart/chart-utils';
import { IChartData } from '../../../report/charts/line-chart/ichart.interface';
import { IEmployeeChartPalette } from '../charts/employee-chart.utils';

/** Translated names of the four cash-flow series, in dataset order. */
export interface ICashFlowSeriesLabels {
	income: string;
	expense: string;
	profit: string;
	bonus: string;
}

/**
 * Translation keys of the four series.
 *
 * Verbatim from `AccountingComponent.generateCharts()` — including the fact that
 * the expenses label comes from the Profit History block rather than the CHARTS
 * block. Picking "tidier" keys here would silently change the legend of a chart
 * users already know.
 */
export const CASH_FLOW_SERIES_KEYS: Readonly<Record<keyof ICashFlowSeriesLabels, string>> = {
	income: 'INCOME_PAGE.INCOME',
	expense: 'DASHBOARD_PAGE.PROFIT_HISTORY.EXPENSES',
	profit: 'DASHBOARD_PAGE.CHARTS.PROFIT',
	bonus: 'DASHBOARD_PAGE.CHARTS.BONUS'
} as const;

/** Untranslated fallback, used only before the language file has resolved. */
export const DEFAULT_CASH_FLOW_LABELS: ICashFlowSeriesLabels = {
	income: CASH_FLOW_SERIES_KEYS.income,
	expense: CASH_FLOW_SERIES_KEYS.expense,
	profit: CASH_FLOW_SERIES_KEYS.profit,
	bonus: CASH_FLOW_SERIES_KEYS.bonus
};

/**
 * Line styling shared by all four series.
 *
 * Copied field for field from the Accounting page so the widget's lines, points
 * and hover targets behave exactly like the page's — `ngx-line-chart` mutates
 * these on hover (see `applyHoverStyles`), so a different `pointRadius` here
 * would make the shared chart component feel different in the two places.
 */
const COMMON_DATASET_OPTIONS = {
	borderWidth: 2,
	pointRadius: 2,
	pointHoverRadius: 4,
	pointHoverBorderWidth: 4,
	tension: 0.4,
	fill: false
} as const;

/**
 * Builds the `ngx-line-chart` datasets for the cash-flow chart.
 *
 * Same four series as the Accounting page (income, expenses, profit, bonus) over
 * the same `IAggregatedEmployeeStatistic.chart` rows, with two deliberate
 * differences:
 *
 * 1. Colours come from the active theme instead of `ChartUtil.CHART_COLORS`'
 *    fixed literals, so the lines stay legible in all eight themes.
 * 2. Cells are coerced with `Number(...) || 0`; the page's bare `pluck` lets a
 *    single `null` reach Chart.js, which then draws a gap in the line with
 *    nothing to explain it.
 *
 * @param rows - The chart rows of the aggregate statistics payload.
 * @param palette - Colours of the active theme.
 * @param labels - Translated series names.
 * @returns The data object `ngx-line-chart` renders.
 */
export function buildCashFlowChartData(
	rows: IChartEmployeeStatistic[] | null | undefined,
	palette: IEmployeeChartPalette,
	labels: ICashFlowSeriesLabels
): IChartData {
	const chart = Array.isArray(rows) ? rows : [];

	return {
		labels: chart.map((row: IChartEmployeeStatistic) => row?.dates ?? ''),
		datasets: [
			buildDataset(labels.income, chart, 'income', palette.revenue),
			buildDataset(labels.expense, chart, 'expense', palette.expenses),
			buildDataset(labels.profit, chart, 'profit', palette.profit),
			buildDataset(labels.bonus, chart, 'bonus', palette.bonus)
		]
	};
}

/**
 * Builds one series of the cash-flow chart.
 *
 * @param label - Translated series name, shown in the legend and tooltip.
 * @param rows - The chart rows of the aggregate statistics payload.
 * @param key - Which figure of each row this series plots.
 * @param color - The series colour, already resolved from the active theme.
 * @returns A Chart.js dataset.
 */
function buildDataset(
	label: string,
	rows: IChartEmployeeStatistic[],
	key: 'income' | 'expense' | 'profit' | 'bonus',
	color: string
) {
	return {
		label,
		data: rows.map((row: IChartEmployeeStatistic) => Number(row?.statistics?.[key]) || 0),
		borderColor: color,
		// Fully transparent until hovered: `ngx-line-chart` re-derives the fill from
		// this value (`transparentize(backgroundColor, 0.4)`), so it must be a colour
		// `@kurkle/color` can parse, not `transparent`.
		backgroundColor: ChartUtil.transparentize(color, 1),
		...COMMON_DATASET_OPTIONS
	};
}
