import { logger } from '@gauzy/desktop-core';
import { createAboutWindow } from '@gauzy/desktop-window';
import { BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { LocalStore } from './desktop-store';
import { TimerService } from './offline';
import { PluginManager } from './plugin-system/data-access/plugin-manager';
import { PluginEventManager } from './plugin-system/events/plugin-event.manager';
import { TranslateService } from './translation';
import { AppWindowManager } from './app-window-manager';

export class AppMenu {
	public menu: MenuItemConstructorOptions[] = [];
	public applicationMenu: MenuItemConstructorOptions;
	public windowMenu: MenuItemConstructorOptions;
	public editMenu: MenuItemConstructorOptions;
	private readonly windowPath: any;

	private readonly pluginManager = PluginManager.getInstance();
	private readonly pluginEventManager = PluginEventManager.getInstance();

	/**
	 * Constructs and initializes the application menu.
	 *
	 * @param {BrowserWindow | null} timeTrackerWindow - The time tracker window instance.
	 * @param {BrowserWindow | null} settingsWindow - The settings window instance.
	 * @param {BrowserWindow | null} updaterWindow - The updater window instance.
	 * @param {any} knex - Knex database instance (if applicable).
	 * @param {any} windowPath - Paths to the necessary window files.
	 * @param {BrowserWindow | null} [serverWindow] - The server window instance (optional).
	 * @param {boolean} [isZoomVisible] - Flag to enable/disable zoom menu options.
	 * @param {boolean} [isCustomMenu] - Flag to use custom menu list
	 */
	constructor(
		timeTrackerWindow: BrowserWindow | null,
		settingsWindow: BrowserWindow | null,
		updaterWindow: BrowserWindow | null,
		knex: any,
		windowPath: any,
		serverWindow?: BrowserWindow | null,
		isZoomVisible?: boolean,
		isCustomMenu?: boolean
	) {
		this.windowPath = windowPath;
		const isZoomEnabled = isZoomVisible ?? false;
		this.applicationMenu = {
			label: 'Gauzy',
			submenu: [
				{
					id: 'gauzy-about',
					label: TranslateService.instant('MENU.ABOUT'),
					enabled: true,
					async click() {
						const window: BrowserWindow = await createAboutWindow(
							windowPath.timeTrackerUi,
							windowPath.preloadPath
						);
						window.show();
					}
				},
				{
					label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
					async click() {
						const appWindowManager = AppWindowManager.getInstance();
						if (!appWindowManager.settingWindow) {
							await appWindowManager.initSettingWindow(windowPath.timeTrackerUi);
							ipcMain.once('setting_window_ready', () => {
								appWindowManager.settingShow('goto_update');
							});
						} else {
							appWindowManager.settingShow('goto_update');
						}
						appWindowManager.settingWindow?.show?.();
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
						const appWindowManager = AppWindowManager.getInstance();
						if (!appWindowManager.settingWindow) {
							await appWindowManager.initSettingWindow(windowPath.timeTrackerUi);
							ipcMain.once('setting_window_ready', () => {
								appWindowManager.settingShow('goto_top_menu');
							});
						}
						appWindowManager.settingWindow?.show?.();
						appWindowManager.settingWindow?.webContents?.toggleDevTools?.();
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
		};
		this.windowMenu = {
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
						logger.info('Last Capture Time (Desktop Menu):', lastTime);
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
						const appWindowManager = AppWindowManager.getInstance();
						if (!appWindowManager.settingWindow) {
							await appWindowManager.initSettingWindow(windowPath.timeTrackerUi);
							ipcMain.once('setting_window_ready', () => {
								appWindowManager.settingShow('goto_top_menu');
							});
						} else {
							appWindowManager.settingShow('goto_top_menu');
						}
						appWindowManager.settingWindow?.show?.();
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
		};
		this.editMenu = {
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
		};
		this.menu = [this.applicationMenu, this.windowMenu, this.editMenu, this.pluginMenu];

		// Build the menu
		if (!isCustomMenu) {
			this.build();
		}

		// Time Tracker Window Menu
		if (timeTrackerWindow) {
			timeTrackerWindow.webContents.send('refresh_menu');
		}

		// Settings Window Menu
		if (settingsWindow) {
			settingsWindow.webContents.send('refresh_menu');
		}

		// Updater Window Menu
		if (updaterWindow) {
			updaterWindow?.webContents?.send?.('refresh_menu');
		}

		// Plugin Event Manager Listener
		this.pluginEventManager.listen(() => {
			// Handle Plugin Menus
			this.handlePluginMenuUpdate();
		});
	}

	/**
	 * Handles updates to the plugin menu and rebuilds the application menu if changes are detected.
	 */
	private handlePluginMenuUpdate(): void {
		const updatedMenu = this.menu.map((menu) => (menu.id === 'plugin-menu' ? this.pluginMenu : menu));

		// Only rebuild the menu if there are actual changes
		if (!this.deepArrayEqual(this.menu, updatedMenu)) {
			this.menu = updatedMenu;
			this.build();
			logger.info('Menu rebuilt after plugin update.');
		} else {
			logger.info('Plugin update detected, but no changes were made to the menu.');
		}
	}

	/**
	 * Builds the application menu.
	 */
	public build(): void {
		Menu.setApplicationMenu(Menu.buildFromTemplate([...this.menu]));
	}

	/**
	 * Dynamically generates the plugin menu for the application.
	 *
	 * @returns {MenuItemConstructorOptions} The menu item for plugins, including a submenu for plugin management.
	 */
	public get pluginMenu(): MenuItemConstructorOptions {
		// Retrieve submenu items from the plugin manager
		const pluginSubmenu = this.pluginManager.getMenuPlugins();

		// Return the plugin menu structure
		return {
			id: 'plugin-menu',
			label: TranslateService.instant('TIMER_TRACKER.SETTINGS.PLUGINS'),
			submenu: [
				{
					label: TranslateService.instant('TIMER_TRACKER.MENU.INSTALL_PLUGIN'),
					click: () => this.openPlugin()
				},
				...pluginSubmenu
			]
		};
	}

	/**
	 * Opens the plugin window.
	 */
	private async openPlugin(): Promise<void> {
		// Show the plugins window
		const appWindowManager = AppWindowManager.getInstance();
		await appWindowManager.initPluginsWindow(this.windowPath?.timeTrackerUi);
		appWindowManager.pluginsWindow?.show?.();
	}

	/**
	 * Compares two arrays deeply to determine if they are equal.
	 */
	private deepArrayEqual<T>(arr1: T, arr2: T) {
		// Implementation for deep array equality check
		return JSON.stringify(arr1) === JSON.stringify(arr2);
	}

	/**
	 * Update default menu list
	 */
	public updateMenuList(menuList: MenuItemConstructorOptions[]): void {
		this.menu = menuList;
	}
}
