import { autoUpdater } from 'electron-updater';
import DesktopNotification from './desktop-notifier';
let showUpdateNotification = false;
const desktopNotification = new DesktopNotification();
import { app } from 'electron';

autoUpdater.on('update-available', (arg) => {
	if (showUpdateNotification) {
        desktopNotification.customNotification(`New update for ${app.getName()} (version ${arg.version}) is available`, app.getName());
        showUpdateNotification = false;
    }
});

export async function appUpdateNotification(updateFeedUrl) {
	showUpdateNotification = true;
	autoUpdater.autoDownload = false;

	autoUpdater.setFeedURL({
		channel: 'latest',
		provider: 'generic',
		url: updateFeedUrl
	});

	await autoUpdater.checkForUpdatesAndNotify();
}
