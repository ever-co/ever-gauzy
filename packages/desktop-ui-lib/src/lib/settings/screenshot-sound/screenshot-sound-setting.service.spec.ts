import { DesktopScreenshotSoundChannel, DesktopScreenshotSoundError } from '@gauzy/contracts';
import { changesScreenshotSound, ScreenshotSoundSettingService } from './screenshot-sound-setting.service';

/**
 * The settings page chooses and resets the custom screenshot sound through the main process (#6715). The
 * collaborators are plain stubs: the service is constructed directly, no TestBed.
 */
describe('ScreenshotSoundSettingService', () => {
	const chime = { path: '/user-data/sounds/screenshot-sound-1.mp3', name: 'chime.mp3' };
	let electron: { invoke: jest.Mock };
	let notifier: { success: jest.Mock; warn: jest.Mock };
	let service: ScreenshotSoundSettingService;

	beforeEach(() => {
		electron = { invoke: jest.fn() };
		notifier = { success: jest.fn(), warn: jest.fn() };
		const translate = { instant: (key: string) => `t(${key})` };
		service = new ScreenshotSoundSettingService(electron as any, notifier as any, translate as any);
	});

	it('asks the main process for a sound, with the file dialog texts in the user language', async () => {
		electron.invoke.mockResolvedValue({ sound: chime });

		const result = await service.choose();

		expect(electron.invoke).toHaveBeenCalledWith(DesktopScreenshotSoundChannel.CHOOSE, {
			title: 't(TIMER_TRACKER.SETTINGS.CHOOSE_SCREENSHOT_SOUND)',
			filterName: 't(TIMER_TRACKER.SETTINGS.SOUND_FILES)'
		});
		expect(result).toEqual({ sound: chime });
		expect(changesScreenshotSound(result)).toBe(true);
		expect(notifier.success).toHaveBeenCalledWith('t(TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_CHANGED)');
	});

	it('says nothing when the dialog is closed without a choice', async () => {
		electron.invoke.mockResolvedValue({ sound: chime, canceled: true });

		const result = await service.choose();

		expect(changesScreenshotSound(result)).toBe(false);
		expect(notifier.success).not.toHaveBeenCalled();
		expect(notifier.warn).not.toHaveBeenCalled();
	});

	it.each([
		[DesktopScreenshotSoundError.UNSUPPORTED, 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_UNSUPPORTED'],
		[DesktopScreenshotSoundError.TOO_LARGE, 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_TOO_LARGE'],
		[DesktopScreenshotSoundError.FAILED, 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_FAILED']
	])('explains a refused file (%s) and changes nothing', async (error, message) => {
		electron.invoke.mockResolvedValue({ sound: null, error });

		const result = await service.choose();

		expect(changesScreenshotSound(result)).toBe(false);
		expect(notifier.warn).toHaveBeenCalledWith(`t(${message})`);
		expect(notifier.success).not.toHaveBeenCalled();
	});

	it('reports a main process that does not answer (an app without the handler) as a failure', async () => {
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		electron.invoke.mockRejectedValue(new Error("No handler registered for 'SELECT_SCREENSHOT_SOUND'"));

		const result = await service.choose();

		expect(result).toEqual({ sound: null, error: DesktopScreenshotSoundError.FAILED });
		expect(notifier.warn).toHaveBeenCalledWith('t(TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_FAILED)');
		error.mockRestore();
	});

	it('goes back to the default sound', async () => {
		electron.invoke.mockResolvedValue({ sound: null });

		const result = await service.reset();

		expect(electron.invoke).toHaveBeenCalledWith(DesktopScreenshotSoundChannel.RESET, undefined);
		expect(changesScreenshotSound(result)).toBe(true);
		expect(result.sound).toBeNull();
		expect(notifier.success).toHaveBeenCalledWith('t(TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_RESET)');
	});
});
