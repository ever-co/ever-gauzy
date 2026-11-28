import {
	CORPORATE_THEME,
	COSMIC_THEME,
	DARK_THEME,
	DEFAULT_THEME,
	GAUZY_DARK,
	GAUZY_LIGHT,
	MATERIAL_DARK_THEME,
	MATERIAL_LIGHT_THEME
} from '../../../../../themes';

/**
 * Gauzy's themes as light / dark pairs, the same pairs the theme pickers show side by side: switching light and
 * dark keeps the person's family of themes (Gauzy, Default, Corporate / Cosmic, Material).
 */
export const LIGHT_DARK_THEME_PAIRS: ReadonlyArray<readonly [light: string, dark: string]> = [
	[GAUZY_LIGHT.name, GAUZY_DARK.name],
	[DEFAULT_THEME.name, DARK_THEME.name],
	[CORPORATE_THEME.name, COSMIC_THEME.name],
	[MATERIAL_LIGHT_THEME.name, MATERIAL_DARK_THEME.name]
];

/** Whether the theme is the dark one of its pair. A theme outside the pairs counts as light. */
export function isDarkThemeName(name: string | null | undefined): boolean {
	return LIGHT_DARK_THEME_PAIRS.some(([, dark]) => dark === name);
}

/**
 * The other theme of the pair: the dark one for a light theme and the other way round. `null` for a theme outside
 * the pairs, which has nothing to switch to.
 */
export function oppositeThemeName(name: string | null | undefined): string | null {
	for (const [light, dark] of LIGHT_DARK_THEME_PAIRS) {
		if (name === light) {
			return dark;
		}
		if (name === dark) {
			return light;
		}
	}
	return null;
}
