import { Notification, nativeImage } from 'electron';
import * as path from 'path';
import { LocalStore } from './desktop-store';

export default class NotificationDesktop {
	timerActionNotification(isStart) {
		const iconPath = path.join(__dirname, '..', 'icons', 'icon.png');
		console.log(iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		const appSetting = LocalStore.getStore('appSetting');
		const notification = new Notification({
			title: 'Gauzy',
			body: isStart ? 'Time Tracking Started' : 'Time Tracking Stopped',
			icon: iconNativePath,
			closeButtonText: 'Close',
			silent: appSetting ? appSetting.mutedNotification : false
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 2000);
	}

	customNotification(message, title) {
		const iconPath = path.join(__dirname, '..', 'icons', 'icon.png');
		console.log(iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		const appSetting = LocalStore.getStore('appSetting');
		const notification = new Notification({
			title: title,
			body: message,
			icon: iconNativePath,
			closeButtonText: 'Close',
			silent: appSetting ? appSetting.mutedNotification : false
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 3000);
	}
}
