import { NbJSThemeOptions } from '@nebular/theme';

/**
 * Colours the three renderings of the monthly employee statistics share.
 *
 * Every one of these used to be a hex literal repeated across the three chart
 * components — `#089c17` / `#dbc300` / `#66de0b` / `#0091ff`, plus `red` and
 * `#ff7b00` for the below-zero bars. Six saturated hues from no palette in
 * particular, identical on all eight themes, and two of them (`#089c17` revenue
 * and `#66de0b` profit) close enough that the two series read as one.
 *
 * They are resolved from the active Nebular theme instead, so the charts track
 * whatever canvas they are drawn on and the four series stay four distinguishable
 * hues in every theme. This mirrors `resolveEmployeeChartPalette` in
 * `@gauzy/ui-core/shared`'s dashboard widget library, which does the same job for
 * the canvas-hosted versions of these charts — it is restated rather than
 * imported because that module is only reachable through the widget barrel, and
 * that barrel is deliberately kept out of application bundles (see the note at
 * the top of `dashboard/widgets/index.ts`).
 */
export interface IEmployeeChartPalette {
	revenue: string;
	expenses: string;
	bonus: string;
	profit: string;
	/** Bonus bars below zero, so a loss reads as one at a glance. */
	negativeBonus: string;
	/** Profit bars below zero. */
	negativeProfit: string;
	/** Legend and tick label colour. */
	textColor: string;
	/** Grid line colour. */
	axisLineColor: string;
}

/**
 * Reads one colour off the theme, falling back to a CSS *named* colour.
 *
 * The fallback is deliberately not a hex literal: nothing here should look like a
 * value copied out of a design file, and a named colour makes it obvious in
 * review that the theme lookup failed.
 */
function themeColour(variables: Record<string, unknown> | undefined, name: string, fallback: string): string {
	const value = variables?.[name];
	return typeof value === 'string' && value ? value : fallback;
}

/**
 * Builds the palette for the currently active theme.
 *
 * @param config - The theme emitted by `NbThemeService.getJsTheme()`.
 * @returns A fully populated palette; never returns an empty colour.
 */
export function resolveEmployeeChartPalette(config: NbJSThemeOptions): IEmployeeChartPalette {
	const variables = (config?.variables ?? {}) as Record<string, unknown>;
	// `chartjs` is the block every Gauzy theme declares for Chart.js specifically,
	// which is what the report line chart already draws its axes from.
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
