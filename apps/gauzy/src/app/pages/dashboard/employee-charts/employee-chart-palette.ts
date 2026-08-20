import { NbJSThemeOptions } from '@nebular/theme';

/**
 * Colours for the monthly employee statistics charts, resolved from the active theme.
 */
export interface IEmployeeChartPalette {
	revenue: string;
	expenses: string;
	bonus: string;
	profit: string;
	/** Bonus bars below zero. */
	negativeBonus: string;
	/** Profit bars below zero. */
	negativeProfit: string;
	/** Legend and tick label colour. */
	textColor: string;
	/** Grid line colour. */
	axisLineColor: string;
}

/**
 * Reads one colour off the theme, falling back to a CSS named colour.
 */
function themeColour(variables: Record<string, unknown> | undefined, name: string, fallback: string): string {
	const value = variables?.[name];
	return typeof value === 'string' && value ? value : fallback;
}

/**
 * Builds the palette for the currently active theme.
 *
 * @param config - The theme emitted by `NbThemeService.getJsTheme()`.
 * @returns A fully populated palette.
 */
export function resolveEmployeeChartPalette(config: NbJSThemeOptions): IEmployeeChartPalette {
	const variables = (config?.variables ?? {}) as Record<string, unknown>;
	const chartJs = (variables['chartjs'] ?? {}) as { textColor?: string; axisLineColor?: string };

	return {
		revenue: themeColour(variables, 'success', 'green'),
		expenses: themeColour(variables, 'warning', 'gold'),
		bonus: themeColour(variables, 'info', 'blue'),
		profit: themeColour(variables, 'successLight', 'lime'),
		negativeBonus: themeColour(variables, 'danger', 'red'),
		negativeProfit: themeColour(variables, 'dangerLight', 'orange'),
		textColor: chartJs.textColor || themeColour(variables, 'fgText', 'gray'),
		axisLineColor: chartJs.axisLineColor || themeColour(variables, 'separator', 'silver')
	};
}
