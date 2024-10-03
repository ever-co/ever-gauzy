import { BrowserWindow, ipcMain } from 'electron';
import { LocalStore } from './desktop-store';
export class DesktopThemeListener {
	constructor() {
		this.listen();
	}

	private listen() {
		ipcMain.removeAllListeners('THEME_CHANGE');
		ipcMain.on('THEME_CHANGE', async (_, theme) => {
			LocalStore.updateApplicationSetting({ theme });
			for (const window of BrowserWindow.getAllWindows()) {
				window.webContents.send('THEME_CHANGE', theme);
			}
		});
	}
}
