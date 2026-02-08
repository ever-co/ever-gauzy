
import { BrowserWindow } from 'electron';
import {
	createAboutWindow,
	createSetupWindow,
	createImageViewerWindow
} from '@gauzy/desktop-window';

enum WindowName {
	ABOUT = 'about',
	SETUP = 'setup',
	IMAGE_VIEW = 'imageView'
}

export class AppWindowManager {
	aboutWindow: BrowserWindow | null = null;
	setupWindow: BrowserWindow | null = null;
	imageView: BrowserWindow | null = null;

	private static instance: AppWindowManager;
	constructor() {};

	static getInstance(): AppWindowManager {
		if (!AppWindowManager.instance) {
			AppWindowManager.instance = new AppWindowManager();
		}
		return AppWindowManager.instance;
	}

	async initAboutWindow(filePath: string) {
		if (this.aboutWindow) {
			return;
		}
		this.aboutWindow = await createAboutWindow(filePath);
		this.eventCloseWindow(this.aboutWindow, WindowName.ABOUT);
	}

	async initSetupWindow(filePath: string): Promise<BrowserWindow> {
		if (this.setupWindow) {
			return this.setupWindow;
		}
		this.setupWindow = await createSetupWindow(this.setupWindow, false, filePath);
		this.eventCloseWindow(this.setupWindow, WindowName.SETUP);
		return this.setupWindow;
	}

	async initImageViewWindow(filePath: string): Promise<BrowserWindow> {
		if (this.imageView) {
			return this.imageView;
		}
		this.imageView = await createImageViewerWindow(this.imageView, filePath);
		this.eventCloseWindow(this.imageView, WindowName.IMAGE_VIEW);
		return this.imageView;
	}

	eventCloseWindow(window: BrowserWindow, windowName: WindowName) {
		window.once('close', () => {
			window.destroy();
			this.clearWindow(windowName);
		});
	}

	clearWindow(windowName: WindowName) {
		switch (windowName) {
			case WindowName.ABOUT:
				this.aboutWindow = null;
				break;
			case WindowName.SETUP:
				this.setupWindow = null;
				break;
			 case WindowName.IMAGE_VIEW:
				this.imageView = null;
				break;
			default:
				break;
		}
	}

}
