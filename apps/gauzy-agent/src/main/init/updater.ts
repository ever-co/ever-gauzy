import { app, ipcMain, autoUpdater } from 'electron';
import { DesktopUpdater } from '@gauzy/desktop-lib';

const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases'
});

ipcMain.on('restart_and_update', () => {
	setImmediate(() => {
		app.removeAllListeners('window-all-closed');
		autoUpdater.quitAndInstall();
		app.exit(0);
	});
});
