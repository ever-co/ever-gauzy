import { shell, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { AppMenu, TranslateService, LocalStore } from '@gauzy/desktop-lib';
import AppWindow from '../window-manager';
const appRootPath: string = path.join(__dirname, '../..');

export class AgentMenu {
	static instance: AgentMenu;
	menuList: MenuItemConstructorOptions[];
	appMenu: AppMenu;
	appWindow: AppWindow;
	constructor() {
		this.appMenu = new AppMenu(null, null, null, null, '', null, false);
		this.appWindow = AppWindow.getInstance(appRootPath);
	}

	static getInstance() {
		if (!AgentMenu.instance) {
			AgentMenu.instance = new AgentMenu();
		}
		return AgentMenu.instance;
	}

	private get agenAppMenu(): MenuItemConstructorOptions {
		const appWindow = this.appWindow;
		return {
			label: 'Gauzy',
			submenu: [
				{
					id: 'gauzy-about',
					label: TranslateService.instant('MENU.ABOUT'),
					enabled: true,
					async click() {
						await appWindow.initAboutWindow();
						appWindow.aboutWindow.show();
					}
				},
				{
					label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
					async click() {
						await appWindow.initSettingWindow();
						const settingsWindow = appWindow.settingWindow;
						settingsWindow.show();
						settingsWindow.webContents.send('goto_update');
						settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
					}
				},
				{
					type: 'separator'
				},
				{
					label: TranslateService.instant('TIMER_TRACKER.MENU.LEARN_MORE'),
					click() {
						shell.openExternal(process.env.COMPANY_SITE_LINK || 'https://gauzy.co/');
					}
				},
				{
					type: 'separator'
				},
				{
					id: 'devtools-setting',
					label: TranslateService.instant('TIMER_TRACKER.MENU.SETTING_DEV_MODE'),
					enabled: true,
					async click() {
						await appWindow.initSettingWindow();
						const settingsWindow = appWindow.settingWindow;
						settingsWindow.webContents.toggleDevTools();
					}
				},
				{
					type: 'separator'
				},
				{
					role: 'quit',
					label: TranslateService.instant('BUTTONS.EXIT')
				}
			]
		}
	}

	private get windowMenu(): MenuItemConstructorOptions {
		const appWindow = this.appWindow;
		return {
			label: TranslateService.instant('TIMER_TRACKER.MENU.WINDOW'),
			submenu: [
				{
					id: 'window-dashboard',
					label: TranslateService.instant('MENU.DASHBOARD'),
					enabled: true,
					async click() {
						await appWindow.initLogWindow();
						appWindow.logWindow.show();
					}
				},
				{
					id: 'window-setting',
					label: TranslateService.instant('TIMER_TRACKER.SETUP.SETTING'),
					enabled: true,
					async click() {
						await appWindow.initSettingWindow();
						const settingsWindow = appWindow.settingWindow;
						settingsWindow.show();
						settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
						settingsWindow.webContents.send('refresh_menu');
					}
				}
			]
		}
	}

	initMenu() {
		this.menuList = [
			this.agenAppMenu,
			this.windowMenu,
			this.appMenu.editMenu,
			this.appMenu.pluginMenu
		];
		this.appMenu.updateMenuList(this.menuList);
		this.appMenu.build();
	}
}
