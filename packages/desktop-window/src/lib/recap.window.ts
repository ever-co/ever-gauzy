import { Menu } from 'electron';
import { DefaultWindow, WindowConfig } from './concretes';
import { WindowManager } from './concretes/window.manager';
import { BaseWindow } from './interfaces/base-window';
import { IBaseWindow } from './interfaces/ibase-window';
import { RegisteredWindow } from './interfaces/iwindow.manager';

export class RecapWindow extends BaseWindow implements IBaseWindow {
	private readonly manager = WindowManager.getInstance();
	constructor(public path?: string) {
		super(
			new DefaultWindow(
				new WindowConfig('/recap', path, {
					frame: false,
					titleBarStyle: 'hidden',
					resizable: false,
					width: 400,
					height: 750,
					vibrancy: 'fullscreen-ui',
					backgroundMaterial: 'acrylic'
				})
			)
		);
		this.browserWindow.setMenuBarVisibility(false);
		this.browserWindow.on('show', () => {
			this.setMenuItemEnabled(false);
		});
		this.browserWindow.on('close', () => {
			this.setMenuItemEnabled(true);
		});

		this.manager.register(RegisteredWindow.RECAP, this);
	}

	private setMenuItemEnabled(isEnabled: boolean) {
		const menu = Menu.getApplicationMenu();
		if (menu) {
			const menuItem = menu.getMenuItemById('gauzy-recap');
			if (menuItem) {
				menuItem.enabled = isEnabled;
			}
		}
	}
}
