import { screen } from 'electron';
import { AlwaysOn } from './always-on';
import { IBaseWindow } from './interfaces';
import { BaseWindow } from './interfaces/base-window';
import { LocalStore } from '@gauzy/desktop-libs';

export class ScreenCaptureNotification
	extends BaseWindow
	implements IBaseWindow {
	private static readonly WIDTH: number = 310;
	private static readonly HEIGHT: number = 170;

	constructor() {
		super(new AlwaysOn());
		this.config.hash = '/screen-capture';
		this.config.path = null;
		this.browserWindow.setOpacity(1);
		this.browserWindow.setSize(
			ScreenCaptureNotification.WIDTH,
			ScreenCaptureNotification.HEIGHT
		);
		this.browserWindow.setPosition(
			screen.getPrimaryDisplay().size.width -
			(ScreenCaptureNotification.WIDTH + 16),
			16
		);
		this.browserWindow.on('show', () => {
			this.browserWindow.focus();
		});
	}

	public show(thumbUrl?: string): void {
		super.show();
		this.browserWindow.webContents.send('show_popup_screen_capture', {
			note: LocalStore.beforeRequestParams().note,
			...(thumbUrl && { imgUrl: thumbUrl }),
		});
	}

	public hide(): void {
		setTimeout(() => {
			super.hide();
		}, 3000);
	}
}
