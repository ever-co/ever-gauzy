/**
 * Colours the team status doughnut needs, resolved from the ACTIVE theme.
 *
 * A `<canvas>` cannot resolve a CSS custom property, so the value has to be
 * looked up in TypeScript — this is the canvas equivalent of `nb-theme()`. The
 * orphaned `gz-doughnut-chart` this widget replaces baked the literal colours
 * `green` / `orange` / `red` into its dataset, which reads wrong in every dark
 * theme and ignores the palette entirely.
 */
export interface ITeamStatusChartPalette {
	/** Members (or teams) with a running timer. */
	online: string;
	/** Worked today but currently idle. */
	working: string;
	/** Did not work in the range. */
	notWorking: string;
	/** Legend label colour. */
	textColor: string;
}

interface IChartColorToken {
	/** Key in `NbJSThemeOptions.variables`, which every shipped theme declares. */
	readonly themeVariable: string;
	/** Matching CSS custom property, for a theme that only declares the SCSS side. */
	readonly cssVariable: string;
	/**
	 * Last resort. Deliberately a CSS *named* colour rather than a hex literal:
	 * nothing here should look like a value copied out of a design file, and a
	 * named colour makes it obvious in review that the theme lookup failed.
	 */
	readonly fallback: string;
}

const COLOR_TOKENS: Readonly<Record<keyof ITeamStatusChartPalette, IChartColorToken>> = {
	online: { themeVariable: 'success', cssVariable: '--color-success-default', fallback: 'green' },
	working: { themeVariable: 'warning', cssVariable: '--color-warning-default', fallback: 'orange' },
	notWorking: { themeVariable: 'danger', cssVariable: '--color-danger-default', fallback: 'crimson' },
	textColor: { themeVariable: 'fgText', cssVariable: '--text-basic-color', fallback: 'gray' }
};

/** Shape of the slice of `NbJSThemeOptions.variables` this chart reads. */
type ThemeVariables = Record<string, unknown> | undefined | null;

/**
 * Resolves the team status palette for the currently active theme.
 *
 * @param variables - `NbJSThemeOptions.variables` of the active theme.
 * @param element - The widget's host element, used to read CSS custom properties
 *                  when the JS theme does not declare a variable.
 * @returns A fully populated palette; never throws and never returns an empty colour.
 */
export function resolveTeamStatusPalette(variables: ThemeVariables, element?: Element | null): ITeamStatusChartPalette {
	// `chartjs` is the block every Gauzy theme declares for Chart.js specifically;
	// preferring its text colour keeps this widget consistent with the other charts.
	const chartJs = (variables?.['chartjs'] ?? {}) as { textColor?: string };

	return {
		online: resolveColor(COLOR_TOKENS.online, variables, element),
		working: resolveColor(COLOR_TOKENS.working, variables, element),
		notWorking: resolveColor(COLOR_TOKENS.notWorking, variables, element),
		textColor: chartJs.textColor || resolveColor(COLOR_TOKENS.textColor, variables, element)
	};
}

/**
 * Resolves one palette slot: JS theme variable, then CSS custom property, then
 * the documented fallback.
 *
 * @param token - The slot to resolve.
 * @param variables - The active theme's JS variables.
 * @param element - Host element for the CSS custom property lookup.
 * @returns A non-empty CSS colour string.
 */
function resolveColor(token: IChartColorToken, variables: ThemeVariables, element?: Element | null): string {
	const themed = variables?.[token.themeVariable];
	if (typeof themed === 'string' && themed.trim()) {
		return themed.trim();
	}

	return readCssVariable(token.cssVariable, element) || token.fallback;
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
