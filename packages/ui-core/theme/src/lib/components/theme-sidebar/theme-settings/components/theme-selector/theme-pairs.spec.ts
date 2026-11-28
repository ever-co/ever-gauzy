import { LIGHT_DARK_THEME_PAIRS, isDarkThemeName, oppositeThemeName } from './theme-pairs';

/** The top bar's light / dark switch keeps the person's theme family. */
describe('light / dark theme pairs', () => {
	it('pairs every Gauzy theme with its light or dark twin', () => {
		expect(LIGHT_DARK_THEME_PAIRS).toEqual([
			['gauzy-light', 'gauzy-dark'],
			['default', 'dark'],
			['corporate', 'cosmic'],
			['material-light', 'material-dark']
		]);
	});

	it.each(LIGHT_DARK_THEME_PAIRS)('switches %p to %p and back', (light, dark) => {
		expect(oppositeThemeName(light)).toBe(dark);
		expect(oppositeThemeName(dark)).toBe(light);
		expect(isDarkThemeName(light)).toBe(false);
		expect(isDarkThemeName(dark)).toBe(true);
	});

	it.each([null, undefined, '', 'some-custom-theme'])('has nothing to switch %p to', (name) => {
		expect(oppositeThemeName(name)).toBeNull();
		expect(isDarkThemeName(name)).toBe(false);
	});
});
