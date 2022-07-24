import { autoUpdater } from 'electron-updater';
import DesktopNotification from './desktop-notifier';
let showUpdateNotification = false;
const desktopNotification = new DesktopNotification();
import { app } from 'electron';
autoUpdater.on('update-available', (arg) => {
	if (showUpdateNotification) {
        desktopNotification.customNotification(`New update ${app.getName()} version ${arg.version} availabe`, app.getName())
        showUpdateNotification = false;
    }
});

export function appUpdateNotification(updateFeedUrl) {
    showUpdateNotification = true;
    autoUpdater.autoDownload = false;
    autoUpdater.setFeedURL({
        channel: 'latest',
        provider: 'generic',
        url: updateFeedUrl
    });
    autoUpdater.checkForUpdatesAndNotify();
}
