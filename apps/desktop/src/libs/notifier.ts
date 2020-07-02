import { Notification, nativeImage } from 'electron';
import * as path from 'path';
export default class NotificationDesktop {
	startTimeNotification() {
		const iconPath = path.join(
			__dirname,
			'..',
			'assets',
			'icons',
			'icon_16x16.png'
		);
		console.log(iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		const notification = new Notification({
			title: 'Gauzy',
			body: 'Time Track Started',
			icon: iconNativePath,
			closeButtonText: 'Close'
		});

		notification.show();
	}
}
