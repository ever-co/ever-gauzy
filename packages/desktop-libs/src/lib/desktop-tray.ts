import { app, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron';
const Store = require('electron-store');
import { LocalStore } from './desktop-store';
import { ipcMain } from 'electron';
import {
	createSettingsWindow,
	loginPage,
	timeTrackerPage,
	getApiBaseUrl,
} from '@gauzy/desktop-window';
import TitleOptions = Electron.TitleOptions;
import { User, UserService } from './offline';
import { handleLogoutDialog } from './desktop-ipc';
import { TranslateService } from './translation';

export class TrayIcon {
	tray: Tray;
	contextMenu: MenuItemConstructorOptions[] = [];
	constructor(
		setupWindow,
		knex,
		timeTrackerWindow,
		auth,
		settingsWindow,
		config,
		windowPath,
		iconPath,
		mainWindow,
		alwaysOn
	) {
		this.removeTrayListener();
		this.removeTimerHandlers();
		let loginPageAlreadyShow = false;
		const options: TitleOptions = { fontType: 'monospacedDigit' };
		const appConfig = LocalStore.getStore('configs');
		const store = new Store();
		console.log('icon path', iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		this.tray = new Tray(iconNativePath);
		this.tray.setTitle('--:--:--', options);
		const userService = new UserService();
		this.contextMenu = [
			{
				id: '4',
				label: TranslateService.instant(
					'TIMER_TRACKER.SETUP.SETTING'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
					settingsWindow.webContents.send('goto_top_menu');
				},
			},
			{
				id: '6',
				label: TranslateService.instant(
					'BUTTONS.CHECK_UPDATE'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('goto_update');
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
				},
			},
			{
				id: '0',
				label: TranslateService.instant(
					'BUTTONS.EXIT'
				),
				click() {
					app.quit();
				},
			},
		];
		const unAuthMenu = [
			{
				id: '4',
				label: TranslateService.instant(
					'TIMER_TRACKER.SETUP.SETTING'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
					settingsWindow.webContents.send('goto_top_menu');
				},
			},
			{
				id: '6',
				label: TranslateService.instant(
					'BUTTONS.CHECK_UPDATE'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('goto_update');
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
				},
			},
			{
				id: '0',
				label: TranslateService.instant(
					'BUTTONS.EXIT'
				),
				click() {
					app.quit();
				},
			},
		];
		const menuAuth = [
			{
				id: '0',
				label: TranslateService.instant(
					'TIMER_TRACKER.MENU.NOW_TRACKING',
					{ timer: 'Oh 00m' }
				),
				visible: false,
			},
			{
				id: '6',
				label: '',
				visible: false,
				enabled: false,
			},
			{
				id: '1',
				label: TranslateService.instant(
					'TIMER_TRACKER.MENU.START_TRACKING'
				),
				visible: appConfig.timeTrackerWindow,
				async click(menuItem) {
					const userLogin = store.get('auth');
					if (userLogin && userLogin.employeeId) {
						timeTrackerWindow.webContents.send(
							'start_from_tray',
							LocalStore.beforeRequestParams()
						);
					} else {
						timeTrackerWindow.show();
						timeTrackerWindow.webContents.send('auth_success_tray_init');
					}
				},
			},
			{
				id: '2',
				label: TranslateService.instant(
					'TIMER_TRACKER.MENU.STOP_TRACKING'
				),
				enabled: false,
				visible: appConfig.timeTrackerWindow,
				click(menuItem) {
					timeTrackerWindow.webContents.send('stop_from_tray');
				},
			},
			{
				id: '3',
				label: TranslateService.instant(
					'TIMER_TRACKER.MENU.OPEN_TIMER'
				),
				enabled: true,
				visible: appConfig.timeTrackerWindow,
				async click(menuItem) {
					timeTrackerWindow.show();
					timeTrackerWindow.webContents.send('auth_success_tray_init');
				},
			},
			{
				id: '6',
				label: TranslateService.instant(
					'BUTTONS.CHECK_UPDATE'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('goto_update');
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
				},
			},
			{
				id: '4',
				label: TranslateService.instant(
					'TIMER_TRACKER.SETUP.SETTING'
				),
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(
							settingsWindow,
							windowPath.timeTrackerUi
						);
					}
					settingsWindow.show();
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
					settingsWindow.webContents.send('goto_top_menu');
				},
			},
			{
				id: '7',
				label: TranslateService.instant(
					'BUTTONS.LOGOUT'
				),
				visible: process.env.IS_DESKTOP_TIMER,
				async click() {
					const appSetting = store.get('appSetting');
					let isLogout = true;

					if (appSetting?.timerStarted) {
						isLogout = await handleLogoutDialog(timeTrackerWindow);
					}
					if (isLogout) {
						timeTrackerWindow.webContents.send('logout');
					}
				},
			},
			{
				id: '5',
				label: TranslateService.instant(
					'BUTTONS.EXIT'
				),
				click() {
					app.quit();
				},
			},
		];

		const menuWindowTime =
			Menu.getApplicationMenu().getMenuItemById('window-time-track');
		const menuWindowSetting =
			Menu.getApplicationMenu().getMenuItemById('window-setting');

		const openWindow = async () => {
			if (process.env.IS_DESKTOP_TIMER) {
				timeTrackerWindow.show();
				timeTrackerWindow.webContents.send('auth_success_tray_init');
			}
		};

		menuWindowSetting.enabled = true;
		auth = store.get('auth');

		if (auth && auth.employeeId && !auth.isLogout) {
			this.contextMenu = menuAuth;
			menuWindowTime.enabled = true;
			timeTrackerWindow.webContents.send(
				'get_user_detail',
				LocalStore.beforeRequestParams()
			);
		} else {
			this.tray.setTitle('--:--:--', options);
			this.contextMenu = unAuthMenu;
			menuWindowTime.enabled = false;
		}

		this.build();

		this.tray.on('double-click', (e) => {
			openWindow();
		});

		ipcMain.on('update_tray_start', (event, arg) => {
			this.contextMenu[2].enabled = false;
			this.contextMenu[0].visible = true;
			this.contextMenu[3].enabled = true;
			this.build();
		});

		ipcMain.on('update_tray_stop', (event, arg) => {
			this.contextMenu[2].enabled = true;
			this.contextMenu[0].visible = false;
			this.contextMenu[3].enabled = false;
			this.build();
		});

		ipcMain.on('update_tray_time_update', (event, arg) => {
			const auth = store.get('auth');
			if (auth && auth.employeeId && !auth.isLogout) {
				this.contextMenu[0].label = TranslateService.instant(
					'TIMER_TRACKER.MENU.NOW_TRACKING',
					{ time: arg }
				);
				this.build();
			}
		});

		ipcMain.on('update_tray_time_title', (event, arg) => {
			const auth = store.get('auth');
			if (auth && auth.employeeId && !auth.isLogout) {
				this.tray.setTitle(arg ? arg.timeRun : '--:--:--', options);
			}
		});

		ipcMain.on('auth_success', async (event, arg) => {
			console.log('Auth Success:', arg);
			const serverConfig = LocalStore.getStore('configs');
			global.variableGlobal = {
				API_BASE_URL: getApiBaseUrl(serverConfig, config),
				IS_INTEGRATED_DESKTOP: serverConfig.isLocalServer,
			};
			try {
				const user = new User({ ...arg, ...arg.user });
				user.remoteId = arg.userId;
				user.organizationId = arg.organizationId;
				if (user.employee) {
					await userService.save(user.toObject());
				}
			} catch (error) {
				console.log('Error on save user', error);
			}
			const appConfig = LocalStore.getStore('configs');
			//check last auth
			const lastUser = store.get('auth');
			if (lastUser && lastUser.userId !== arg.userId) {
				LocalStore.updateConfigProject({
					projectId: null,
					taskId: null,
					note: null,
					organizationContactId: null,
					organizationTeamId: null,
				});
			}
			store.set({
				auth: { ...arg, isLogout: false },
			});

			menuWindowTime.visible = appConfig.timeTrackerWindow;
			menuWindowSetting.enabled = true;

			if (arg.employeeId) {
				this.contextMenu = menuAuth;
				menuWindowTime.enabled = true;
			} else {
				this.tray.setTitle('--:--:--', options);
				this.contextMenu = unAuthMenu;
				menuWindowTime.enabled = false;
			}

			this.build();

			if (timeTrackerWindow && arg.employeeId) {
				await timeTrackerWindow.loadURL(
					timeTrackerPage(windowPath.timeTrackerUi)
				);
				timeTrackerWindow.webContents.send(
					'auth_success_tray_init',
					arg
				);
				if (!appConfig.gauzyWindow) {
					timeTrackerWindow.show();
				}
			}
		});

		ipcMain.handle('FINAL_LOGOUT', async (event, arg) => {
			this.tray.setTitle('--:--:--', options);
			this.tray.setContextMenu(Menu.buildFromTemplate(unAuthMenu));
			menuWindowTime.enabled = false;

			const appSetting = store.get('appSetting');
			if (appSetting && appSetting.timerStarted) {
				timeTrackerWindow.webContents.send('stop_from_tray');
			}

			if (settingsWindow) settingsWindow.hide();

			if (LocalStore.getStore('configs').gauzyWindow) {
				timeTrackerWindow.webContents.send('clear_store');
				timeTrackerWindow.hide();
			} else {
				if (
					!loginPageAlreadyShow &&
					!process.env.IS_DESKTOP_TIMER
				) {
					const serverConfig = LocalStore.getStore('configs');
					global.variableGlobal = {
						API_BASE_URL: getApiBaseUrl(serverConfig, config),
						IS_INTEGRATED_DESKTOP: serverConfig.isLocalServer,
					};
					await timeTrackerWindow.loadURL(
						loginPage(windowPath.gauzyWindow)
					);
					timeTrackerWindow.webContents.once(
						'did-finish-load',
						() => {
							timeTrackerWindow.webContents.send('hide_register');
						}
					);
					timeTrackerWindow.show();
					loginPageAlreadyShow = true;
				}
			}
			alwaysOn.hide();
			await userService.remove();
			LocalStore.updateAuthSetting({ isLogout: true });
		});

		ipcMain.on('logout', async (evt, arg) => {
			if (timeTrackerWindow) {
				timeTrackerWindow.webContents.send('logout');
			}
		});

		ipcMain.on('user_detail', (event, arg) => {
			if (
				arg.employee &&
				arg.employee.organization &&
				arg.employee.organization.name
			) {
				this.contextMenu[1].label = arg.employee.organization.name;
				this.contextMenu[1].visible = true;
			}
		});
	}

	public destroy() {
		this.tray.destroy();
	}

	public removeTimerHandlers() {
		const channels = [
			'FINAL_LOGOUT'
		];
		channels.forEach((channel: string) => {
			ipcMain.removeHandler(channel);
		});
	}

	public removeTrayListener() {
		const trayListener = [
			'update_tray_start',
			'update_tray_stop',
			'update_tray_time_update',
			'update_tray_time_title',
			'auth_success',
			'user_detail',
		];

		trayListener.forEach((listener) => {
			ipcMain.removeAllListeners(listener);
		});
	}

	public build(): void {
		if (!this.tray) {
			return;
		}
		this.tray.setContextMenu(Menu.buildFromTemplate([...this.contextMenu]));
	}
}
