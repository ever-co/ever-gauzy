import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow
} from '@gauzy/desktop-core';

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
