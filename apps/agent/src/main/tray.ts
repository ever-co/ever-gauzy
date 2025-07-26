import {
	Tray,
	nativeImage,
	shell,
	app,
	Menu,
	MenuItemConstructorOptions,
} from 'electron';
import { TranslateService } from '@gauzy/desktop-lib';
import AppWindow from './window-manager';
import * as path from 'path';

type ISiteUrl = {
	helpSiteUrl: string
}
const appWindow = AppWindow.getInstance(path.join(__dirname, '..'));

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
	static instance: TrayMenu;
	constructor(
		trayIconPath: string,
		useCommonMenu: boolean,
		siteUrls: ISiteUrl,
	) {
		if (!TrayMenu.instance) {
			TrayMenu.instance = this;
			this.trayIconPath = trayIconPath;
			this.useCommonMenu = useCommonMenu;
			this.siteUrls = siteUrls;
		}
	}

	static getInstance(trayIconPath: string, useCommonMenu: boolean, siteUrls: ISiteUrl): TrayMenu {
		if (!TrayMenu.instance) {
			TrayMenu.instance = new TrayMenu(trayIconPath, useCommonMenu, siteUrls);
			return TrayMenu.instance;
		}
		return TrayMenu.instance;
	}

	nativeIconPath() {
		const iconNativePath = nativeImage.createFromPath(this.trayIconPath);
		iconNativePath.resize(this.trayIconSize);
		return iconNativePath;
	}

	getCommonMenu(siteUrls: ISiteUrl): MenuItemConstructorOptions[] {
		return [
			{
				id: 'tray_log',
				label: TranslateService.instant('MENU.DASHBOARD'),
				async click() {
					await appWindow.initLogWindow();
					appWindow.logWindow.show();
				}
			},
			{
				id: 'tray_setting',
				label: TranslateService.instant('MENU.SETTINGS'),
				async click() {
					await appWindow.initSettingWindow();
					appWindow.settingWindow.show();
					appWindow.settingWindow.webContents.send('setting_page_ipc', {
						type: 'goto_top_menu'
					});
					appWindow.settingWindow.webContents.send('refresh_menu');
				}
			},
			{
				type: 'separator'
			},
			{
				id: 'keyboard_mouse',
				label: 'Keyboard and mouse tracker',
				type: 'checkbox',
				checked: false,
				enabled: false
			},
			{
				id: 'network',
				label: 'Network',
				type: 'checkbox',
				checked: false,
				enabled: false
			},
			{
				id: 'afk',
				label: 'AFK',
				type: 'checkbox',
				checked: false,
				enabled: false
			},
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
				label: TranslateService.instant('MENU.ABOUT'),
				async click() {
					await appWindow.initAboutWindow();
				}
			},
			{
				id: 'tray_exit',
				label: `${TranslateService.instant('BUTTONS.EXIT')}`,
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
		this.tray.setTitle('State: Startup', {
			fontType: 'monospacedDigit'
		});
		this.tray.setToolTip('Agent is starting up');
	}

	public updateStatus(
		menuId: 'keyboard_mouse' | 'network' | 'afk',
		checked: boolean = false
	) {
		const menuIdx = this.TrayMenuList.findIndex((menu) => menu.id === menuId);
		if (menuIdx !== -1) {
			this.TrayMenuList[menuIdx].checked = checked;
		}
		this.tray?.setContextMenu(Menu.buildFromTemplate(this.TrayMenuList));
	}

	public updateExitVisibility(visible = true) {
		const menuIdx = this.TrayMenuList.findIndex((menu) => menu.id === 'tray_exit');
		if (menuIdx !== -1) {
			this.TrayMenuList[menuIdx].visible = visible;
		}
		this.tray?.setContextMenu(Menu.buildFromTemplate(this.TrayMenuList));
	}

	public updateTitle(status: 'Working' | 'Error' | 'Startup' | 'Network error' | 'Afk' | 'Idle') {
		if (this.tray) {
			this.tray.setTitle(`Status: ${status}`);
			this.tray.setToolTip(`Agent is ${status}`);
		}

	}

	public updateTryMenu() {
		this.setMenuList([]);
	}

	build() {
		this.initTray();
		this.setMenuList([]);
		return this.tray;
	}
}

export default TrayMenu;
