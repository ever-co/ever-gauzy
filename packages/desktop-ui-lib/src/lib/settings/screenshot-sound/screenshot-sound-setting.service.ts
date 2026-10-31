import { Injectable } from '@angular/core';
import {
	DesktopScreenshotSoundChannel,
	DesktopScreenshotSoundError,
	IDesktopScreenshotSoundResult
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { ElectronService } from '../../electron/services';
import { ToastrNotificationService } from '../../services';

/** The message shown for each reason a picked file was not used. */
export const SCREENSHOT_SOUND_ERROR_MESSAGES: Readonly<Record<DesktopScreenshotSoundError, string>> = {
	[DesktopScreenshotSoundError.UNSUPPORTED]: 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_UNSUPPORTED',
	[DesktopScreenshotSoundError.TOO_LARGE]: 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_TOO_LARGE',
	[DesktopScreenshotSoundError.FAILED]: 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_FAILED'
};

/** Whether a result changed the screenshot sound (not closed without a choice, not refused). */
export function changesScreenshotSound(result: IDesktopScreenshotSoundResult | null | undefined): boolean {
	return !!result && !result.canceled && !result.error;
}

/**
 * The custom screenshot sound of the settings page (#6715): asks the main process, which keeps the sound on this
 * computer, and tells the user how it went.
 */
@Injectable({ providedIn: 'root' })
export class ScreenshotSoundSettingService {
	constructor(
		private readonly _electronService: ElectronService,
		private readonly _notifier: ToastrNotificationService,
		private readonly _translateService: TranslateService
	) {}

	/** Asks for a sound file and uses it as the screenshot sound of this computer. */
	public choose(): Promise<IDesktopScreenshotSoundResult> {
		return this.request(
			DesktopScreenshotSoundChannel.CHOOSE,
			'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_CHANGED',
			// The file dialog is the main process's, which may not have the user's language
			{
				title: this._translateService.instant('TIMER_TRACKER.SETTINGS.CHOOSE_SCREENSHOT_SOUND'),
				filterName: this._translateService.instant('TIMER_TRACKER.SETTINGS.SOUND_FILES')
			}
		);
	}

	/** Goes back to the sound bundled with the app. */
	public reset(): Promise<IDesktopScreenshotSoundResult> {
		return this.request(DesktopScreenshotSoundChannel.RESET, 'TIMER_TRACKER.SETTINGS.SCREENSHOT_SOUND_RESET');
	}

	private async request(
		channel: DesktopScreenshotSoundChannel,
		successMessage: string,
		data?: unknown
	): Promise<IDesktopScreenshotSoundResult> {
		let result: IDesktopScreenshotSoundResult;
		try {
			result = await this._electronService.invoke<unknown, IDesktopScreenshotSoundResult>(channel, data);
		} catch (error) {
			console.error('Could not change the screenshot sound', error);
			result = { sound: null, error: DesktopScreenshotSoundError.FAILED };
		}
		if (!result) {
			result = { sound: null, error: DesktopScreenshotSoundError.FAILED };
		}

		if (result.error) {
			const message =
				SCREENSHOT_SOUND_ERROR_MESSAGES[result.error] ??
				SCREENSHOT_SOUND_ERROR_MESSAGES[DesktopScreenshotSoundError.FAILED];
			this._notifier.warn(this._translateService.instant(message));
		} else if (!result.canceled) {
			this._notifier.success(this._translateService.instant(successMessage));
		}
		return result;
	}
}
