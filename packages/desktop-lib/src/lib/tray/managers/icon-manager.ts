import { Tray, nativeImage } from 'electron';
import * as path from 'node:path';

export class IconManager {
	constructor(
		private tray: Tray,
		private iconPath: string
	) { };

	updateIcon(iconState: 'start' | 'stop'): void {
		const iconDir = path.dirname(this.iconPath);
		let iconPathFull: string;
		if (iconState === 'start') {
			iconPathFull = path.join(iconDir, 'icon.png');
		} else {
			iconPathFull = path.join(iconDir, 'icon_gray.png');
		}
		const nativeIcon = nativeImage.createFromPath(iconPathFull);
		nativeIcon.resize({ width: 16, height: 16 });
		this.tray.setImage(nativeIcon);
	}
}
