import { DesktopScreenshotSoundChannel } from '@gauzy/contracts';
import { BrowserWindow, ipcMain } from 'electron';
import { chooseScreenshotSound, IScreenshotSoundDialogLabels, resetScreenshotSound } from './screenshot-sound.service';

/**
 * Answers the settings page's custom screenshot sound requests (#6715). Safe to call again: the handlers are replaced.
 */
export function registerScreenshotSoundHandlers(): void {
	removeScreenshotSoundHandlers();
	ipcMain.handle(DesktopScreenshotSoundChannel.CHOOSE, (event, labels?: IScreenshotSoundDialogLabels) =>
		chooseScreenshotSound(BrowserWindow.fromWebContents(event.sender), labels ?? {})
	);
	ipcMain.handle(DesktopScreenshotSoundChannel.RESET, () => resetScreenshotSound());
}

/** Stops answering the custom screenshot sound requests. */
export function removeScreenshotSoundHandlers(): void {
	for (const channel of Object.values(DesktopScreenshotSoundChannel)) {
		ipcMain.removeHandler(channel);
	}
}
