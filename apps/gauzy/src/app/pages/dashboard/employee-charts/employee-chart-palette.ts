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
	/** Card surface the chart sits on — the tooltip's ground, and the gap between marks. */
	surface: string;
	/** Hairline used for the tooltip's edge. */
	borderColor: string;
	/** Primary ink, for tooltip values. */
	strongTextColor: string;
}

/**
 * Reads one colour off the theme, falling back to a CSS named colour.
 */
function themeColour(variables: Record<string, unknown> | undefined, name: string, fallback: string): string {
	const value = variables?.[name];
	return typeof value === 'string' && value ? value : fallback;
}

/**
 * Reads one `--gauzy-*` custom property off the host element.
 *
 * The chart palette lives in the theme maps rather than in this file so every
 * registered theme carries its own steps (see `gauzy-chart-*` in
 * `_gauzy-theme-maps.scss`). Those are emitted as CSS custom properties, so the
 * only way to see them from TypeScript is to resolve them against a live
 * element — inherited from whichever `.nb-theme-*` class is currently on the
 * page, which is also what makes this follow a theme switch for free.
 */
function cssToken(styles: CSSStyleDeclaration | undefined, name: string, fallback: string): string {
	const value = styles?.getPropertyValue(name)?.trim();
	return value || fallback;
}

/**
 * Builds the palette for the currently active theme.
 *
 * @param config - The theme emitted by `NbThemeService.getJsTheme()`.
 * @param host - An element inside the themed tree. Omit it and the function
 *   falls back to Nebular's raw status colours, which is what these charts used
 *   before the `gauzy-chart-*` tokens existed: correct, but not the tuned steps.
 * @returns A fully populated palette.
 */
export function resolveEmployeeChartPalette(config: NbJSThemeOptions, host?: Element | null): IEmployeeChartPalette {
	const variables = (config?.variables ?? {}) as Record<string, unknown>;
	const chartJs = (variables['chartjs'] ?? {}) as { textColor?: string; axisLineColor?: string };

	// Guarded: `getComputedStyle` is absent when this runs outside a browser.
	const styles =
		host && typeof getComputedStyle === 'function' ? getComputedStyle(host as Element) : (undefined as any);

	const text = cssToken(styles, '--gauzy-chart-label', chartJs.textColor || themeColour(variables, 'fgText', 'gray'));

	return {
		revenue: cssToken(styles, '--gauzy-chart-revenue', themeColour(variables, 'success', 'green')),
		expenses: cssToken(styles, '--gauzy-chart-expenses', themeColour(variables, 'warning', 'gold')),
		bonus: cssToken(styles, '--gauzy-chart-bonus', themeColour(variables, 'info', 'blue')),
		profit: cssToken(styles, '--gauzy-chart-profit', themeColour(variables, 'successLight', 'lime')),
		negativeBonus: cssToken(styles, '--gauzy-chart-negative', themeColour(variables, 'danger', 'red')),
		negativeProfit: cssToken(styles, '--gauzy-chart-negative', themeColour(variables, 'dangerLight', 'orange')),
		textColor: text,
		axisLineColor: cssToken(
			styles,
			'--gauzy-chart-grid',
			chartJs.axisLineColor || themeColour(variables, 'separator', 'silver')
		),
		surface: cssToken(styles, '--gauzy-card-1', themeColour(variables, 'bg', '#ffffff')),
		borderColor: cssToken(styles, '--gauzy-border-default-color', 'rgba(126, 126, 143, 0.2)'),
		strongTextColor: cssToken(styles, '--gauzy-text-color-1', text)
	};
}
