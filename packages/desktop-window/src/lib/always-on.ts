import { screen } from 'electron';
import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow
} from '@gauzy/desktop-core';

export class AlwaysOn extends BaseWindow implements IBaseWindow {
	private static readonly WIDTH: number = 60;
	private static readonly HEIGHT: number = 110;
	private manager = WindowManager.getInstance();

	constructor(private readonly path?: string) {
		super(
			new DefaultWindow(
				new WindowConfig('/always-on', path, {
					frame: false,
					resizable: false,
					roundedCorners: true,
					width: AlwaysOn.WIDTH,
					height: AlwaysOn.HEIGHT,
					opacity: 0.8,
					alwaysOnTop: true,
					center: false,
					x: 16,
					y: Math.floor((screen.getPrimaryDisplay().workAreaSize.height - AlwaysOn.HEIGHT) / 2)
				})
			)
		);
		this.browserWindow.setMenuBarVisibility(false);
		this.manager.register(RegisteredWindow.WIDGET, this);
	}

	public show(): void {
		this.onTop();
		super.show();
	}

	public hide(): void {
		this.undoOnTop();
		super.hide();
	}

	private onTop(): void {
		this.browserWindow.setSkipTaskbar(true);
		this.browserWindow.setVisibleOnAllWorkspaces(true, {
			visibleOnFullScreen: true,
			skipTransformProcessType: false
		});
		this.browserWindow.setAlwaysOnTop(true, 'pop-up-menu', 2);
		this.browserWindow.setFullScreenable(false);
	}

	private undoOnTop(): void {
		this.browserWindow.setVisibleOnAllWorkspaces(false);
		this.browserWindow.setAlwaysOnTop(false);
	}
}
