import { DefaultWindow, WindowConfig } from './concretes';
import { WindowManager } from './concretes/window.manager';
import { IBaseWindow } from './interfaces';
import { BaseWindow } from './interfaces/base-window';
import { RegisteredWindow } from './interfaces/iwindow.manager';

export class SplashScreen extends BaseWindow implements IBaseWindow {
	private readonly manager = WindowManager.getInstance();
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
		this.manager.register(RegisteredWindow.SPLASH, this);
	}
}
