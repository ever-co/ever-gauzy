import { createAboutWindow, createSettingsWindow, RegisteredWindow, WindowManager } from '@gauzy/desktop-window';
import { BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { LocalStore } from './desktop-store';
import { TimerService } from './offline';
import { PluginManager } from './plugin-system/data-access/plugin-manager';
import { PluginEventManager } from './plugin-system/events/plugin-event.manager';
import { TranslateService } from './translation';

export class AppMenu {
	public menu: MenuItemConstructorOptions[] = [];
	private readonly pluginManager = PluginManager.getInstance();
	private readonly pluginEventManager = PluginEventManager.getInstance();
	private readonly windowManager = WindowManager.getInstance();

	constructor(timeTrackerWindow, settingsWindow, updaterWindow, knex, windowPath, serverWindow?, isZoomVisible?) {
		const isZoomEnabled = isZoomVisible;
		this.menu = [
			{
				label: 'Gauzy',
				submenu: [
					{
						id: 'gauzy-about',
						label: TranslateService.instant('MENU.ABOUT'),
						enabled: true,
						async click() {
							const window: BrowserWindow = await createAboutWindow(windowPath.timeTrackerUi, windowPath.preloadPath);
							window.show();
						}
					},
					{
						label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
						async click() {
							if (!settingsWindow) {
								settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
							}
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
							if (!settingsWindow) {
								settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
							}
							settingsWindow.webContents.toggleDevTools();
						}
					},
					{
						id: 'devtools-time-tracker',
						label: TranslateService.instant('TIMER_TRACKER.MENU.TIMER_DEV_MODE'),
						enabled: true,
						visible: timeTrackerWindow ? true : false,
						click() {
							if (timeTrackerWindow) timeTrackerWindow.webContents.toggleDevTools();
						}
					},
					{
						id: 'devtools-server',
						label: TranslateService.instant('TIMER_TRACKER.MENU.SERVER_DEV_MODE'),
						enabled: true,
						visible: serverWindow ? true : false,
						click() {
							if (serverWindow) serverWindow.webContents.toggleDevTools();
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
			},
			{
				label: TranslateService.instant('TIMER_TRACKER.MENU.WINDOW'),
				submenu: [
					{
						id: 'window-time-track',
						label: TranslateService.instant('TIMER_TRACKER.TIMER'),
						enabled: false,
						visible: LocalStore.getStore('configs') && LocalStore.getStore('configs').timeTrackerWindow,
						async click() {
							timeTrackerWindow.show();
							const timerService = new TimerService();
							const lastTime = await timerService.findLastCapture();
							console.log('Last Capture Time (Desktop Menu):', lastTime);
							timeTrackerWindow.webContents.send('timer_tracker_show', {
								...LocalStore.beforeRequestParams(),
								timeSlotId: lastTime ? lastTime.timeslotId : null
							});
						}
					},
					{
						id: 'window-setting',
						label: TranslateService.instant('TIMER_TRACKER.SETUP.SETTING'),
						enabled: true,
						async click() {
							if (!settingsWindow) {
								settingsWindow = await createSettingsWindow(
									settingsWindow,
									windowPath.timeTrackerUi,
									windowPath.preloadPath
								);
							}
							settingsWindow.show();
							settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
							settingsWindow.webContents.send(timeTrackerWindow ? 'goto_top_menu' : 'goto_update');
							settingsWindow.webContents.send('refresh_menu');
						}
					},
					{
						label: TranslateService.instant('TIMER_TRACKER.MENU.ZOOM_IN'),
						role: 'zoomIn',
						accelerator: 'CmdOrCtrl+Plus',
						visible: isZoomVisible,
						enabled: isZoomEnabled
					},
					{
						label: TranslateService.instant('TIMER_TRACKER.MENU.ZOOM_OUT'),
						role: 'zoomOut',
						accelerator: 'CmdOrCtrl+-',
						visible: isZoomVisible,
						enabled: isZoomEnabled
					}
				]
			},
			{
				label: TranslateService.instant('BUTTONS.EDIT'),
				submenu: [
					{
						label: TranslateService.instant('BUTTONS.CUT'),
						role: 'cut'
					},
					{
						label: TranslateService.instant('BUTTONS.COPY'),
						role: 'copy'
					},
					{
						label: TranslateService.instant('BUTTONS.PASTE'),
						role: 'paste'
					},
					{
						label: TranslateService.instant('BUTTONS.SELECT_ALL'),
						role: 'selectAll'
					}
				]
			},
			this.pluginMenu
		];
		this.build();
		if (timeTrackerWindow) {
			timeTrackerWindow.webContents.send('refresh_menu');
		}
		if (settingsWindow) {
			settingsWindow.webContents.send('refresh_menu');
		}
		if (updaterWindow) {
			updaterWindow.webContents.send('refresh_menu');
		}

		this.pluginEventManager.listen(() => {
			// Determine if the updated menu
			const updatedMenu = this.menu.map((menu) => (menu.id === 'plugin-menu' ? this.pluginMenu : menu));
			// Only rebuild the menu if there was an actual change
			if (!this.deepArrayEqual(this.menu, updatedMenu)) {
				this.menu = updatedMenu;
				this.build();
				console.log('Menu rebuilt after plugin update.');
			} else {
				console.log('Plugin update detected, but no changes were made to the menu.');
			}
		});
	}

	public build(): void {
		Menu.setApplicationMenu(Menu.buildFromTemplate([...this.menu]));
	}

	public get pluginMenu(): MenuItemConstructorOptions {
		const submenu = this.pluginManager.getMenuPlugins();

		return {
			id: 'plugin-menu',
			label: TranslateService.instant('TIMER_TRACKER.SETTINGS.PLUGIN'),
			submenu: [
				{
					label: 'Install Plugin',
					click: () => {
						const settingWindow = this.windowManager.getOne(RegisteredWindow.SETTINGS);
						this.windowManager.show(RegisteredWindow.SETTINGS);
						this.windowManager
							.webContents(settingWindow)
							.send('app_setting', LocalStore.getApplicationConfig());
					}
				},
				...submenu
			]
		} as MenuItemConstructorOptions;
	}

	private deepArrayEqual<T>(arr1: T, arr2: T) {
		return JSON.stringify(arr1) === JSON.stringify(arr2);
	}
}
