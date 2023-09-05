import { BaseWindow } from './interfaces/base-window';
import { DefaultWindow, WindowConfig } from './concretes';
import { IBaseWindow } from './interfaces';

export class SplashScreen extends BaseWindow implements IBaseWindow {
	constructor(public path: string) {
		super(
			new DefaultWindow(
				new WindowConfig('/splash-screen', path, {
					frame: false,
					resizable: false,
					width: 300,
					height: 240
				})
			)
		);
		this.browserWindow.setMenuBarVisibility(false);
	}
}
