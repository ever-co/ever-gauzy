import { app, Menu, nativeImage, Tray } from 'electron';
const Store = require('electron-store');
import { LocalStore } from './desktop-store';
import { ipcMain } from 'electron';
import { createSettingsWindow, loginPage, timeTrackerPage, getApiBaseUrl } from '@gauzy/desktop-window';
import TitleOptions = Electron.TitleOptions;
import { User, UserService } from './offline';

export class TrayIcon {
	tray: Tray;
	constructor(setupWindow, knex, timeTrackerWindow, auth, settingsWindow, config, windowPath, iconPath, mainWindow) {
		this.removeTrayListener();
		let loginPageAlreadyShow = false;
		const options: TitleOptions = { fontType: 'monospacedDigit' };
		const appConfig = LocalStore.getStore('configs');
		const store = new Store();
		console.log('icon path', iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		this.tray = new Tray(iconNativePath);
		this.tray.setTitle('--:--:--', options);
		let contextMenu: any = [
			{
				id: '4',
				label: 'Setting',
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
					settingsWindow.webContents.send('goto_top_menu');
				}
			},
			{
				id: '6',
				label: 'Check For Update',
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
				id: '0',
				label: 'Exit',
				click() {
					app.quit();
				}
			}
		];
		const unAuthMenu = [
			{
				id: '4',
				label: 'Setting',
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
					settingsWindow.webContents.send('goto_top_menu');
				}
			},
			{
				id: '6',
				label: 'Check For Update',
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
				id: '0',
				label: 'Exit',
				click() {
					app.quit();
				}
			}
		];
		const menuAuth = [
			{
				id: '0',
				label: 'Now tracking time - 0h 0m',
				visible: false
			},
			{
				id: '6',
				label: '',
				visible: false,
				enabled: false
			},
			{
				id: '1',
				label: 'Start Tracking Time',
				visible: appConfig.timeTrackerWindow,
				async click(menuItem) {
					const userLogin = store.get('auth');
					if (userLogin && userLogin.employeeId) {
						timeTrackerWindow.webContents.send('start_from_tray', LocalStore.beforeRequestParams());
					} else {
						timeTrackerWindow.show();
						timeTrackerWindow.webContents.send('auth_success_tray_init');
					}
				}
			},
			{
				id: '2',
				label: 'Stop Tracking Time',
				enabled: false,
				visible: appConfig.timeTrackerWindow,
				click(menuItem) {
					timeTrackerWindow.webContents.send('stop_from_tray');
				}
			},
			{
				id: '3',
				label: 'Open Time Tracker',
				enabled: true,
				visible: appConfig.timeTrackerWindow,
				async click(menuItem) {
					timeTrackerWindow.show();
					timeTrackerWindow.webContents.send('auth_success_tray_init');
				}
			},
			{
				id: '6',
				label: 'Check For Update',
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
				id: '4',
				label: 'Setting',
				async click() {
					if (!settingsWindow) {
						settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
					}
					settingsWindow.show();
					settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
					settingsWindow.webContents.send('goto_top_menu');
				}
			},
			{
				id: '7',
				label: 'Logout',
				visible: app.getName() === 'gauzy-desktop-timer',
				click() {
					timeTrackerWindow.webContents.send('logout');
				}
			},
			{
				id: '5',
				label: 'Exit',
				click() {
					app.quit();
				}
			}
		];

		const menuWindowTime = Menu.getApplicationMenu().getMenuItemById('window-time-track');
		const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById('window-setting');

		const openWindow = async () => {
			if (app.getName() === 'gauzy-desktop-timer') {
				timeTrackerWindow.show();
				timeTrackerWindow.webContents.send('auth_success_tray_init');
			} else {
				mainWindow.show();
			}
		};

		if (auth && auth.employeeId) {
			contextMenu = menuAuth;
			menuWindowSetting.enabled = true;
			menuWindowTime.enabled = true;
			timeTrackerWindow.webContents.send('get_user_detail', LocalStore.beforeRequestParams());
		}
		this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));

		this.tray.on('double-click', (e) => {
			openWindow();
		});

		ipcMain.on('update_tray_start', (event, arg) => {
			contextMenu[2].enabled = false;
			contextMenu[0].visible = true;
			contextMenu[3].enabled = true;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('update_tray_stop', (event, arg) => {
			contextMenu[2].enabled = true;
			contextMenu[0].visible = false;
			contextMenu[3].enabled = false;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('update_tray_time_update', (event, arg) => {
			contextMenu[0].label = `Now tracking time - ${arg}`;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('update_tray_time_title', (event, arg) => {
			this.tray.setTitle(arg ? arg.timeRun : '--:--:--', options);
		});

		ipcMain.on('auth_success', async (event, arg) => {
			console.log('Auth Success:', arg);
			try {
				const userService = new UserService();
				const user = new User({ ...arg, ...arg.user });
				user.remoteId = arg.userId;
				user.organizationId = arg.organizationId;
				await userService.save(user.toObject());
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
					organizationContactId: null
				});
			}
			store.set({
				auth: { ...arg, isLogout: false }
			});
			if (arg.employeeId) {
				contextMenu = menuAuth;
				menuWindowTime.enabled = true;
				menuWindowSetting.enabled = true;
				menuWindowTime.visible = appConfig.timeTrackerWindow;
				this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
			}

			if (!appConfig.gauzyWindow) {
				timeTrackerWindow.loadURL(timeTrackerPage(windowPath.timeTrackerUi));
				timeTrackerWindow.show();
			}
			if (timeTrackerWindow) {
				timeTrackerWindow.webContents.send('auth_success_tray_init');
			}
		});

		ipcMain.on('logout', () => {
			this.tray.setContextMenu(Menu.buildFromTemplate(unAuthMenu));
			menuWindowTime.enabled = false;

			const appSetting = store.get('appSetting');
			if (appSetting && appSetting.timerStarted) {
				timeTrackerWindow.webContents.send('stop_from_tray');
			}

			if (settingsWindow) settingsWindow.hide();

			if (LocalStore.getStore('configs').gauzyWindow) {
				timeTrackerWindow.hide();
			} else {
				if (!loginPageAlreadyShow && app.getName() !== 'gauzy-desktop-timer') {
					const serverConfig = LocalStore.getStore('configs');
					global.variableGlobal = {
						API_BASE_URL: getApiBaseUrl(serverConfig, config),
						IS_INTEGRATED_DESKTOP: serverConfig.isLocalServer
					};
					timeTrackerWindow.loadURL(loginPage(windowPath.gauzyWindow));
					timeTrackerWindow.webContents.once('did-finish-load', () => {
						timeTrackerWindow.webContents.send('hide_register');
					});
					timeTrackerWindow.show();
					loginPageAlreadyShow = true;
				}
			}
		});

		ipcMain.on('user_detail', (event, arg) => {
			if (arg.employee && arg.employee.organization && arg.employee.organization.name) {
				contextMenu[1].label = arg.employee.organization.name;
				contextMenu[1].visible = true;
			}
		});
	}

	destroy() {
		this.tray.destroy();
	}

	removeTrayListener() {
		const trayListener = [
			'update_tray_start',
			'update_tray_stop',
			'update_tray_time_update',
			'update_tray_time_title',
			'auth_success',
			'logout',
			'user_detail'
		];

		trayListener.forEach((listener) => {
			ipcMain.removeAllListeners(listener);
		});
	}
}
