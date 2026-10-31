/**
 * A window reads the sound settings through their own IPC handler (#7141).
 */
const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock(
	'electron',
	() => ({
		ipcMain: {
			handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
				if (handlers.has(channel)) {
					// What Electron does with a second handler on a channel
					throw new Error(`Attempted to register a second handler for '${channel}'`);
				}
				handlers.set(channel, handler);
			},
			removeHandler: (channel: string) => handlers.delete(channel)
		}
	}),
	{ virtual: true }
);

let appSetting: Record<string, unknown> | undefined;
jest.mock('../desktop-store', () => ({
	LocalStore: {
		getStore: (key: string) => (key === 'appSetting' ? appSetting : undefined)
	}
}));

import { DesktopSoundSettingsChannel } from '@gauzy/contracts';
import { registerSoundSettingsHandlers, removeSoundSettingsHandlers } from './sound-settings.ipc';

describe('sound settings IPC handler', () => {
	beforeEach(() => handlers.clear());

	it('can be registered again (the main handler runs more than once) without throwing', () => {
		registerSoundSettingsHandlers();

		expect(() => registerSoundSettingsHandlers()).not.toThrow();
		expect([...handlers.keys()]).toEqual(['GET_SOUND_SETTINGS']);
	});

	it('answers with the sound settings only, read when asked', async () => {
		registerSoundSettingsHandlers();
		const read = handlers.get(DesktopSoundSettingsChannel.GET);

		appSetting = { timerStartStopSound: true, mutedNotification: true, serverUrl: 'https://api.example.com' };
		expect(await read({ sender: {} })).toEqual({ timerStartStopSound: true });

		appSetting = { ...appSetting, timerStartStopSound: false };
		expect(await read({ sender: {} })).toEqual({ timerStartStopSound: false });
	});

	it('can be removed', () => {
		registerSoundSettingsHandlers();

		removeSoundSettingsHandlers();

		expect(handlers.size).toBe(0);
	});
});
