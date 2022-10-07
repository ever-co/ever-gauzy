import {nativeImage, Notification} from 'electron';
import * as path from 'path';
import {LocalStore} from './desktop-store';
import NativeImage = Electron.NativeImage;

export default class NotificationDesktop {
	private readonly _iconPath: string;
	private readonly _iconNativePath: NativeImage;

	constructor() {
		this._iconPath = path.join(__dirname, '..', 'icons', 'icon.png');
		this._iconNativePath = nativeImage.createFromPath(this._iconPath);
		this._iconNativePath.resize({width: 16, height: 16});
	}

	private get _isSilent(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.mutedNotification : false;
	}

	public customNotification(message, title) {
		const notification = new Notification({
			title: title,
			body: message,
			icon: this._iconNativePath,
			closeButtonText: 'Close',
			silent: this._isSilent
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 3000);
	}

	public timerActionNotification(isStart) {
		const notification = new Notification({
			title: 'Gauzy',
			body: isStart ? 'Time Tracking Started' : 'Time Tracking Stopped',
			icon: this._iconNativePath,
			closeButtonText: 'Close',
			silent: this._isSilent
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 2000);
	}
}
