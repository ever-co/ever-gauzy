import { IDesktopSoundSettings } from '@gauzy/contracts';
import { LocalStore } from '../desktop-store';

/** The sound settings of an application setting: each one off unless switched on. */
export function toSoundSettings(appSetting: unknown): IDesktopSoundSettings {
	const setting = (appSetting ?? {}) as { timerStartStopSound?: unknown };
	return { timerStartStopSound: setting.timerStartStopSound === true };
}

/** The sound settings of this computer, read from the stored application setting. */
export function getSoundSettings(): IDesktopSoundSettings {
	return toSoundSettings(LocalStore.getStore('appSetting'));
}
