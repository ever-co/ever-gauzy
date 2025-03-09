import {
	Tray,
	nativeImage,
	shell,
	app,
	Menu,
	MenuItemConstructorOptions,
    BrowserWindow
} from 'electron';
import { TranslateService } from '@gauzy/desktop-lib';
import AppWindow from './window-manager';
import * as path from 'path';

type ISiteUrl = {
	helpSiteUrl: string
}
const appWindow = new AppWindow(path.join(__dirname, '..'));

class TrayMenu {
	private trayIconPath: string;
	private trayIconSize: {
		width: number;
		height: number;
	} = {
		width: 16,
		height: 16
	};
	private TrayMenuList: MenuItemConstructorOptions[] = [];
	private tray: Tray | null = null;
	private useCommonMenu: boolean;
	private siteUrls: ISiteUrl;
	constructor(
		trayIconPath: string,
		useCommonMenu: boolean,
		siteUrls: ISiteUrl,
	) {
		this.trayIconPath = trayIconPath;
		this.useCommonMenu = useCommonMenu;
		this.siteUrls = siteUrls;
	}

	nativeIconPath() {
		const iconNativePath = nativeImage.createFromPath(this.trayIconPath);
		iconNativePath.resize(this.trayIconSize);
		return iconNativePath;
	}


	getCommonMenu(siteUrls: ISiteUrl): MenuItemConstructorOptions[] {
		return [
			{
				type: 'separator'
			},
			{
				id: 'tray_help',
				label: TranslateService.instant('TIMER_TRACKER.MENU.HELP'),
				click() {
					shell.openExternal(siteUrls.helpSiteUrl);
				}
			},
			{
				id: 'tray_about',
				label: TranslateService.instant('TIMER_TRACKER.MENU.ABOUT'),
				async click() {
					await appWindow.initAboutWindow();
					appWindow.aboutWindow.show();
				}
			},
			{
				id: 'server_exit',
				label: `${TranslateService.instant('BUTTONS.EXIT')} ${app.getName()}`,
				click() {
					app.quit();
				}
			}
		];
	}

	private setMenuList(menuList: MenuItemConstructorOptions[] = []) {
		this.TrayMenuList = [...menuList];
		if (this.useCommonMenu) {
			this.TrayMenuList = [...this.TrayMenuList, ...this.getCommonMenu(this.siteUrls)];
		}
		this.tray?.setContextMenu(Menu.buildFromTemplate(this.TrayMenuList));
	}


	private initTray() {
		this.tray = new Tray(this.nativeIconPath());
	}

	public updateTryMenu() {
	}

	build() {
		this.initTray();
		this.setMenuList();
		return this.tray;
	}
}

export default TrayMenu;
