import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow
} from '@gauzy/desktop-core';
import { screen } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
console.log = log.log;
Object.assign(console, log.functions);

const store = new Store();

export class ScreenCaptureNotification extends BaseWindow implements IBaseWindow {
	private static readonly WIDTH: number = 310;
	private static readonly HEIGHT: number = 170;
	private readonly manager = WindowManager.getInstance();

	constructor(path?: string) {
		super(
			new DefaultWindow(
				new WindowConfig('/screen-capture', path, {
					frame: false,
					resizable: false,
					roundedCorners: true,
					width: ScreenCaptureNotification.WIDTH,
					height: ScreenCaptureNotification.HEIGHT,
					alwaysOnTop: true,
					center: false,
					focusable: false,
					skipTaskbar: true,
					x: screen.getPrimaryDisplay().size.width - (ScreenCaptureNotification.WIDTH + 16),
					y: 16
				})
			)
		);

		this.browserWindow.setVisibleOnAllWorkspaces(true, {
			visibleOnFullScreen: true,
			skipTransformProcessType: false
		});
		this.browserWindow.setAlwaysOnTop(true);
		this.browserWindow.setFullScreenable(false);
		this.manager.register(RegisteredWindow.CAPTURE, this);
	}

	public show(thumbUrl?: string): void {
		if (!this.browserWindow) return;
		this.browserWindow.showInactive();
		this.browserWindow.webContents.send('show_popup_screen_capture', {
			note: store.get('project').note,
			...(thumbUrl && { imgUrl: thumbUrl })
		});
	}

	public hide(): void {
		setTimeout(() => {
			super.hide();
		}, 3000);
	}
}
