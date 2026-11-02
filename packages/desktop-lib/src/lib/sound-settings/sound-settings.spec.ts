/**
 * The time tracker reads only the sound settings (#7141), not the whole configuration.
 */
let appSetting: Record<string, unknown> | undefined;
jest.mock('../desktop-store', () => ({
	LocalStore: {
		getStore: (key: string) => (key === 'appSetting' ? appSetting : undefined)
	}
}));

import { getSoundSettings, toSoundSettings } from './sound-settings';

describe('sound settings', () => {
	describe('toSoundSettings', () => {
		it('keeps only the sound settings', () => {
			expect(
				toSoundSettings({ timerStartStopSound: true, mutedNotification: false, theme: 'dark', serverUrl: 'x' })
			).toEqual({ timerStartStopSound: true });
		});

		it.each([[{}], [{ timerStartStopSound: false }], [{ timerStartStopSound: 'true' }], [null], [undefined]])(
			'leaves the start and stop sounds off unless switched on (%p)',
			(setting) => {
				expect(toSoundSettings(setting)).toEqual({ timerStartStopSound: false });
			}
		);
	});

	describe('getSoundSettings', () => {
		it('reads the stored application setting', () => {
			appSetting = { timerStartStopSound: true, mutedNotification: true };

			expect(getSoundSettings()).toEqual({ timerStartStopSound: true });
		});

		it('answers with the defaults before anything is stored', () => {
			appSetting = undefined;

			expect(getSoundSettings()).toEqual({ timerStartStopSound: false });
		});
	});
});
