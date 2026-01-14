import { shell, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { AppMenu, TranslateService, LocalStore } from '@gauzy/desktop-lib';
import AppWindow from '../window-manager';
const appRootPath: string = path.join(__dirname, '../..');
import MainEvent from '../events/events';
import { MAIN_EVENT_TYPE, MAIN_EVENT } from '../../constant';

export enum MenuType {
	onboarding = 'onboarding',
	main = 'main'
}

export class AgentMenu {
	private static instance: AgentMenu;
	private appMenu: AppMenu;
	private appWindow: AppWindow;
	private _isSetup: boolean;
	private constructor() {
		this.appMenu = new AppMenu(null, null, null, null, '', null, false, true);
		this.appWindow = AppWindow.getInstance(appRootPath);
	}

	static getInstance(): AgentMenu {
		if (!AgentMenu.instance) {
			AgentMenu.instance = new AgentMenu();
		}
		return AgentMenu.instance;
	}

	public get isSetup(): boolean {
		return this._isSetup;
	}

	public set isSetup(value: boolean) {
		this._isSetup = value;
	}

	private get aboutMenu(): MenuItemConstructorOptions {
		const appWindow = this.appWindow;
		return {
			id: 'gauzy-about',
			label: TranslateService.instant('MENU.ABOUT'),
			enabled: true,
			async click() {
				await appWindow.initAboutWindow();
				appWindow.aboutWindow.show();
			}
		}
	}

	private get learnMoreMenu(): MenuItemConstructorOptions {
		return {
			label: TranslateService.instant('TIMER_TRACKER.MENU.LEARN_MORE'),
			click() {
				shell.openExternal(process.env.COMPANY_SITE_LINK || 'https://gauzy.co/');
			}
		}
	}

	private get quitMenu(): MenuItemConstructorOptions {
		return {
			label: TranslateService.instant('BUTTONS.EXIT'),
			click() {
				const mainEvent = MainEvent.getInstance();
				mainEvent.emit(MAIN_EVENT, {
					type: MAIN_EVENT_TYPE.EXIT_APP
				});
			}
		}
	}

	private get agentAppMenu(): MenuItemConstructorOptions {
		const appWindow = this.appWindow;
		const baseApplicationMenu = this.appMenu.applicationMenu;
		return {
			...baseApplicationMenu,
			submenu: [
				this.aboutMenu,
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
				this.learnMoreMenu,
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
				this.quitMenu
			]
		};
	}

	private get windowMenu(): MenuItemConstructorOptions {
		const appWindow = this.appWindow;
		const baseWindowMenu = this.appMenu.windowMenu;
		return {
			...baseWindowMenu,
			submenu: [
				{
					id: 'window-dashboard',
					label: TranslateService.instant('MENU.DASHBOARD'),
					enabled: true,
					async click() {
						await appWindow.initLogWindow();
						appWindow.logWindowShow();
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

	menuList(type: MenuType): MenuItemConstructorOptions[] {
		switch (type) {
			case MenuType.main:
				return [
					this.agentAppMenu,
					this.windowMenu,
					this.appMenu.editMenu,
					this.appMenu.pluginMenu
				];
			case MenuType.onboarding:
				return [
					{
						...this.appMenu.applicationMenu,
						submenu: [
							this.aboutMenu,
							{
								type: 'separator'
							},
							this.learnMoreMenu,
							{
								type: 'separator'
							},
							this.quitMenu
						]
					}
				];
			default:
				return [];
		}
	}

	initMenu(type: MenuType = MenuType.main): void {
		this.appMenu.updateMenuList(this.menuList(type));
		this.appMenu.build();
	}
}
