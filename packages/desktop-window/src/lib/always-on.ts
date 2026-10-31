import {
	BaseWindow,
	DefaultWindow,
	IBaseWindow,
	IWindowPosition,
	RegisteredWindow,
	WindowConfig,
	WindowManager
} from '@gauzy/desktop-core';
import { screen } from 'electron';
import { WindowPositionMemory } from './utils/window-position-memory';

export class AlwaysOn extends BaseWindow implements IBaseWindow {
	/** The size of each widget: compact, and expanded (a bar). Read per widget, never changed. */
	public static readonly SIZES = { compact: { width: 60, height: 110 }, expand: { width: 270, height: 45 } } as const;
	/** Where each size of the widget was last left (#7683): the compact and the expanded widget differ in size. */
	public static readonly POSITION_KEYS = { compact: 'always-on-compact', expand: 'always-on-expand' } as const;
	private readonly manager = WindowManager.getInstance();

	constructor(
		private readonly path?: string,
		private readonly preloadPath?: string,
		private readonly contextIsolation?: boolean,
		private readonly isExpandMode?: boolean
	) {
		// The size of this widget's own mode: a compact widget opened after an expanded one keeps its own size
		const size = isExpandMode ? AlwaysOn.SIZES.expand : AlwaysOn.SIZES.compact;

		// Back where the user left it when that spot is on a connected display, at the default place otherwise
		const positionMemory = new WindowPositionMemory(
			isExpandMode ? AlwaysOn.POSITION_KEYS.expand : AlwaysOn.POSITION_KEYS.compact
		);
		const position = positionMemory.restore(size) ?? AlwaysOn.defaultPosition(size.height);

		super(
			new DefaultWindow(
				new WindowConfig('/always-on', path, {
					frame: false,
					resizable: false,
					roundedCorners: true,
					width: size.width,
					height: size.height,
					...(isExpandMode
						? {
								transparent: true
							}
						: {
								opacity: 0.8
							}),
					alwaysOnTop: true,
					center: false,
					x: position.x,
					y: position.y,
					...(contextIsolation && preloadPath
						? {
								webPreferences: {
									nodeIntegration: false,
									contextIsolation: true,
									sandbox: false,
									webSecurity: false,
									preload: preloadPath
								}
							}
						: {})
				})
			)
		);
		this.browserWindow.setMenuBarVisibility(false);
		this.manager.register(RegisteredWindow.WIDGET, this);
		this.manager.overrideSystemContextMenu(this.browserWindow);
		this.browserWindow.on('close', () => {
			if (this.isDestroyed()) {
				return;
			}
			this.browserWindow.destroy();
		});

		this.browserWindow.on('closed', () => {
			this.manager.unregister(RegisteredWindow.WIDGET);
		});

		positionMemory.track(this.browserWindow);
	}

	/** Where the widget opens when it has no remembered position: the left edge, half-way down the primary display. */
	private static defaultPosition(height: number): IWindowPosition {
		return {
			x: 16,
			y: Math.floor((screen.getPrimaryDisplay().workAreaSize.height - height) / 2)
		};
	}

	public override show(): void {
		if (this.isDestroyed()) {
			return;
		}
		this.onTop();
		super.show();
	}

	public override hide(): void {
		this.undoOnTop();
		super.hide();
	}

	public override close(): void {
		if (this.isDestroyed()) {
			return;
		}
		this.hide();
		super.close();
	}

	public isDestroyed(): boolean {
		if (!this.browserWindow) {
			return true;
		}
		return this.browserWindow.isDestroyed();
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
