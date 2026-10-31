import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Choosing a custom screenshot sound (#6715). Electron cannot run here: `app.getPath('userData')` is a temporary
 * folder, the file dialog answers what a test needs, and the settings are an in-memory object. Files are real.
 */
let userData: string;
const showOpenDialog = jest.fn();
jest.mock(
	'electron',
	() => ({
		app: { getPath: () => userData },
		dialog: { showOpenDialog: (...args: unknown[]) => showOpenDialog(...args) }
	}),
	{ virtual: true }
);

let appSetting: Record<string, any> | undefined;
jest.mock('../desktop-store', () => ({
	LocalStore: {
		getStore: (key: string) => (key === 'appSetting' ? appSetting : undefined),
		updateApplicationSetting: (values: Record<string, unknown>) => {
			appSetting = { ...(appSetting ?? {}), ...values };
		}
	}
}));

import { DesktopScreenshotSoundError } from '@gauzy/contracts';
import {
	chooseScreenshotSound,
	importScreenshotSound,
	playScreenshotSound,
	resetScreenshotSound,
	resolveScreenshotSoundPath,
	screenshotSoundDirectory
} from './screenshot-sound.service';
import { SCREENSHOT_SOUND_MAX_BYTES } from './screenshot-sound';

describe('custom screenshot sound', () => {
	let picked: string;
	let bundled: string;

	/** A file of the given size in the test folder, outside the app's data folder */
	const file = (name: string, bytes = 16) => {
		const filePath = path.join(picked, name);
		fs.writeFileSync(filePath, Buffer.alloc(bytes, 1));
		return filePath;
	};

	beforeEach(() => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-screenshot-sound-'));
		userData = path.join(root, 'user-data');
		picked = path.join(root, 'music');
		fs.mkdirSync(userData);
		fs.mkdirSync(picked);
		bundled = file('snapshot-sound.wav');
		appSetting = { mutedNotification: false };
		showOpenDialog.mockReset();
	});

	afterEach(() => {
		fs.rmSync(path.dirname(userData), { recursive: true, force: true });
	});

	describe('importScreenshotSound', () => {
		it('plays a copy kept in the app data folder, which survives the original being deleted', () => {
			const chime = file('My Chime.MP3');

			const result = importScreenshotSound(chime);

			expect(result.error).toBeUndefined();
			expect(result.sound.name).toBe('My Chime.MP3');
			expect(path.dirname(result.sound.path)).toBe(screenshotSoundDirectory());
			expect(path.extname(result.sound.path)).toBe('.mp3');
			expect(appSetting.customScreenshotSound).toEqual(result.sound);

			fs.rmSync(chime);
			expect(resolveScreenshotSoundPath(bundled)).toBe(result.sound.path);
		});

		it('deletes the previous copy when another sound is chosen, under a new name', () => {
			const first = importScreenshotSound(file('one.wav')).sound;
			const second = importScreenshotSound(file('two.ogg')).sound;

			expect(second.path).not.toBe(first.path);
			expect(fs.existsSync(first.path)).toBe(false);
			expect(fs.readdirSync(screenshotSoundDirectory())).toEqual([path.basename(second.path)]);
		});

		it('refuses a file that is not a supported sound, and keeps the current one', () => {
			const current = importScreenshotSound(file('one.wav')).sound;

			const result = importScreenshotSound(file('notes.txt'));

			expect(result).toEqual({ sound: current, error: DesktopScreenshotSoundError.UNSUPPORTED });
			expect(appSetting.customScreenshotSound).toEqual(current);
			expect(fs.existsSync(current.path)).toBe(true);
		});

		it('refuses a file larger than a notification sound needs', () => {
			const result = importScreenshotSound(file('song.wav', SCREENSHOT_SOUND_MAX_BYTES + 1));

			expect(result).toEqual({ sound: null, error: DesktopScreenshotSoundError.TOO_LARGE });
			expect(appSetting.customScreenshotSound).toBeUndefined();
		});

		it('reports a file that cannot be read, without changing anything', () => {
			const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

			const result = importScreenshotSound(path.join(picked, 'missing.wav'));

			expect(result).toEqual({ sound: null, error: DesktopScreenshotSoundError.FAILED });
			expect(appSetting.customScreenshotSound).toBeUndefined();
			error.mockRestore();
		});
	});

	describe('chooseScreenshotSound', () => {
		it('opens a sound file dialog on the settings window, with the texts of the page', async () => {
			const window = { id: 1 } as any;
			showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file('ding.wav')] });

			const result = await chooseScreenshotSound(window, { title: 'Choisir un son', filterName: 'Sons' });

			expect(showOpenDialog).toHaveBeenCalledWith(window, {
				title: 'Choisir un son',
				properties: ['openFile'],
				filters: [{ name: 'Sons', extensions: ['wav', 'mp3', 'ogg'] }]
			});
			expect(result.sound.name).toBe('ding.wav');
		});

		it('falls back to English texts when the page sends none, or something else than text', async () => {
			showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

			await chooseScreenshotSound(null, { title: { evil: true } as any, filterName: '   ' });

			expect(showOpenDialog).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Choose a screenshot sound',
					filters: [{ name: 'Sound files', extensions: ['wav', 'mp3', 'ogg'] }]
				})
			);
		});

		it('changes nothing when the dialog is closed without a choice', async () => {
			const current = importScreenshotSound(file('one.wav')).sound;
			showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

			const result = await chooseScreenshotSound(null);

			expect(result).toEqual({ sound: current, canceled: true });
			expect(appSetting.customScreenshotSound).toEqual(current);
		});
	});

	describe('resetScreenshotSound', () => {
		it('goes back to the bundled sound and deletes the copy', () => {
			const current = importScreenshotSound(file('one.wav')).sound;

			expect(resetScreenshotSound()).toEqual({ sound: null });

			expect(appSetting.customScreenshotSound).toBeNull();
			expect(fs.existsSync(current.path)).toBe(false);
			expect(resolveScreenshotSoundPath(bundled)).toBe(bundled);
		});

		it('never deletes a file outside the app sounds folder, even if the settings point to one', () => {
			const outside = file('keep-me.wav');
			appSetting.customScreenshotSound = { path: outside, name: 'keep-me.wav' };

			resetScreenshotSound();

			expect(fs.existsSync(outside)).toBe(true);
		});
	});

	describe('playScreenshotSound', () => {
		const window = () => ({ webContents: { send: jest.fn() } });

		it('plays the bundled sound by default', () => {
			const target = window();

			playScreenshotSound(target, bundled);

			expect(target.webContents.send).toHaveBeenCalledWith('play_sound', { soundFile: bundled });
		});

		it('plays the custom sound once chosen', () => {
			const { sound } = importScreenshotSound(file('ding.ogg'));
			const target = window();

			playScreenshotSound(target, bundled);

			expect(target.webContents.send).toHaveBeenCalledWith('play_sound', { soundFile: sound.path });
		});

		it('stays silent when the sound is muted, custom sound or not', () => {
			const target = window();
			appSetting.mutedNotification = true;

			playScreenshotSound(target, bundled);
			importScreenshotSound(file('ding.ogg'));
			playScreenshotSound(target, bundled);

			expect(target.webContents.send).not.toHaveBeenCalled();
		});

		it('stays silent when no sound file exists, and never throws', () => {
			const target = window();

			playScreenshotSound(target, path.join(picked, 'missing.wav'));
			expect(() => playScreenshotSound(null, bundled)).not.toThrow();

			expect(target.webContents.send).not.toHaveBeenCalled();
		});
	});
});
