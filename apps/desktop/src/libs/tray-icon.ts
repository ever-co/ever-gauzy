import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
const Store = require('electron-store');
import TimerHandler from './timer';
import { LocalStore } from './getSetStore';
import { ipcMain } from 'electron';
import { TimerData } from '../local-data/timer';
import { createSettingsWindow } from '../window/settings';
export default class TrayIcon {
	tray: Tray;
	constructor(setupWindow, knex, timeTrackerWindow, auth, settingsWindow) {
		const timerHandler = new TimerHandler();
		const store = new Store();
		const iconPath = path.join(
			__dirname,
			'..',
			'assets',
			'icons',
			'icon_16x16.png'
		);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		this.tray = new Tray(iconNativePath);
		let contextMenu: any = [
			{
				id: '0',
				label: 'quit',
				click() {
					app.quit();
				}
			}
		];
		const unAuthMenu = [
			{
				id: '0',
				label: 'quit',
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
				id: '1',
				label: 'Start Tracking Time',
				click(menuItem) {
					const projectSelect = store.get('project');
					if (projectSelect && projectSelect.projectId) {
						// timeTrackerWindow.show();
						setTimeout(() => {
							timeTrackerWindow.webContents.send(
								'start_from_tray'
							);
						}, 1000);
					} else {
						timeTrackerWindow.show();
						setTimeout(async () => {
							const lastTime: any = await TimerData.getLastTimer(
								knex,
								LocalStore.beforeRequestParams()
							);
							timeTrackerWindow.webContents.send(
								'timer_tracker_show',
								{
									...LocalStore.beforeRequestParams(),
									timeSlotId:
										lastTime && lastTime.length > 0
											? lastTime[0].timeSlotId
											: null
								}
							);
						}, 1000);
					}
				}
			},
			{
				id: '2',
				label: 'Stop Tracking Time',
				enabled: false,
				click(menuItem) {
					// timeTrackerWindow.show();
					setTimeout(() => {
						timeTrackerWindow.webContents.send('stop_from_tray');
					}, 1000);
				}
			},
			{
				id: '3',
				label: 'Open Time Tracker',
				enabled: true,
				click(menuItem) {
					timeTrackerWindow.show();
					setTimeout(async () => {
						const lastTime: any = await TimerData.getLastTimer(
							knex,
							LocalStore.beforeRequestParams()
						);
						timeTrackerWindow.webContents.send(
							'timer_tracker_show',
							{
								...LocalStore.beforeRequestParams(),
								timeSlotId:
									lastTime && lastTime.length > 0
										? lastTime[0].timeSlotId
										: null
							}
						);
					}, 1000);
				}
			},
			{
				id: '4',
				label: 'Setting',
				click() {
					const appSetting = LocalStore.getStore('appSetting');
					if (!settingsWindow) {
						settingsWindow = createSettingsWindow(settingsWindow);
					}
					settingsWindow.show();
					setTimeout(() => {
						settingsWindow.webContents.send('app_setting', {
							setting: appSetting
						});
					}, 500);
				}
			},
			{
				id: '5',
				label: 'quit',
				click() {
					app.quit();
				}
			}
		];

		const menuWindowTime = Menu.getApplicationMenu().getMenuItemById('window-time-track');
		const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById('window-setting');
		if (auth && auth.employeeId) {
			contextMenu = menuAuth;
			menuWindowSetting.enabled = true;
			menuWindowTime.enabled = true;
		}
		this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));

		ipcMain.on('update_tray_start', (event, arg) => {
			contextMenu[1].enabled = false;
			contextMenu[0].visible = true;
			contextMenu[2].enabled = true;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('update_tray_stop', (event, arg) => {
			contextMenu[1].enabled = true;
			contextMenu[0].visible = false;
			contextMenu[2].enabled = false;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('update_tray_time_update', (event, arg) => {
			contextMenu[0].label = `Now tracking time - ${arg.hours}h ${arg.minutes}m`;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('auth_success', (event, arg) => {
			//check last auth
			const lastUser = store.get('auth');
			if (lastUser && lastUser.userId !== arg.userId) {
				store.set({
					project: null
				})
			}
			store.set({
				auth: arg
			});
			if (arg.employeeId) {
				contextMenu = menuAuth;
				menuWindowTime.enabled = true;
				menuWindowSetting.enabled = true;
			}
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});

		ipcMain.on('logout', () => {
			this.tray.setContextMenu(Menu.buildFromTemplate(unAuthMenu));
			menuWindowSetting.enabled = false;
			menuWindowTime.enabled = false;
			const appSetting = store.get('appSetting');
			if (appSetting.timerStarted) {
				setTimeout(() => {
					timeTrackerWindow.webContents.send('stop_from_tray');
				}, 1000);
			}
			timeTrackerWindow.hide();
			if (settingsWindow) settingsWindow.hide();
		})
	}
}
