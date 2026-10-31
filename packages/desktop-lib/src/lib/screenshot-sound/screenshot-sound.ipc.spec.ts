/**
 * The settings page chooses and resets the custom screenshot sound through two IPC handlers (#6715).
 */
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const settingsWindow = { id: 7 };
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
		},
		BrowserWindow: { fromWebContents: () => settingsWindow }
	}),
	{ virtual: true }
);

const chooseScreenshotSound = jest.fn(async () => ({ sound: null, canceled: true }));
const resetScreenshotSound = jest.fn(() => ({ sound: null }));
jest.mock('./screenshot-sound.service', () => ({
	chooseScreenshotSound: (...args: unknown[]) => chooseScreenshotSound(...(args as [])),
	resetScreenshotSound: () => resetScreenshotSound()
}));

import { DesktopScreenshotSoundChannel } from '@gauzy/contracts';
import { registerScreenshotSoundHandlers, removeScreenshotSoundHandlers } from './screenshot-sound.ipc';

describe('screenshot sound IPC handlers', () => {
	beforeEach(() => {
		handlers.clear();
		jest.clearAllMocks();
	});

	it('can be registered again (the main handler runs more than once) without throwing', () => {
		registerScreenshotSoundHandlers();

		expect(() => registerScreenshotSoundHandlers()).not.toThrow();
		expect([...handlers.keys()].sort()).toEqual(['RESET_SCREENSHOT_SOUND', 'SELECT_SCREENSHOT_SOUND']);
	});

	it('opens the dialog on the window that asked, with the texts it sent', async () => {
		registerScreenshotSoundHandlers();

		await handlers.get(DesktopScreenshotSoundChannel.CHOOSE)({ sender: {} }, { title: 'Choose' });

		expect(chooseScreenshotSound).toHaveBeenCalledWith(settingsWindow, { title: 'Choose' });
	});

	it('resets to the bundled sound', async () => {
		registerScreenshotSoundHandlers();

		expect(await handlers.get(DesktopScreenshotSoundChannel.RESET)({ sender: {} })).toEqual({ sound: null });
		expect(resetScreenshotSound).toHaveBeenCalled();
	});

	it('can be removed', () => {
		registerScreenshotSoundHandlers();

		removeScreenshotSoundHandlers();

		expect(handlers.size).toBe(0);
	});
});
