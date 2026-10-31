import { DesktopSoundSettingsChannel } from '@gauzy/contracts';
import { ipcMain } from 'electron';
import { getSoundSettings } from './sound-settings';

/**
 * Lets a window read only the sound settings (the time tracker's start and stop sounds, #7141). Safe to call again:
 * the handler is replaced.
 */
export function registerSoundSettingsHandlers(): void {
	removeSoundSettingsHandlers();
	ipcMain.handle(DesktopSoundSettingsChannel.GET, () => getSoundSettings());
}

/** Stops answering the sound settings requests. */
export function removeSoundSettingsHandlers(): void {
	for (const channel of Object.values(DesktopSoundSettingsChannel)) {
		ipcMain.removeHandler(channel);
	}
}
