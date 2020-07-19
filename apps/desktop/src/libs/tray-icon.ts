import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
const Store = require('electron-store');
import TimerHandler from './timer';
import { LocalStore } from './getSetStore';
import { ipcMain } from 'electron';

export default class TrayIcon {
	tray: Tray;
	constructor(win2, knex, win3) {
		const timerHandler = new TimerHandler();
		const store = new Store();
		const iconPath = path.join(
			__dirname,
			'..',
			'assets',
			'icons',
			'icon_16x16.png'
		);
		console.log(iconPath);
		const iconNativePath = nativeImage.createFromPath(iconPath);
		iconNativePath.resize({ width: 16, height: 16 });
		this.tray = new Tray(iconNativePath);
		const contextMenu = [
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
						win3.show();
						win3.webContents.send(
							'timer_tracker_show',
							LocalStore.beforeRequestParams()
						);
						win3.webContents.send('start_from_tray');
					} else {
						const auth = store.get('auth');
						auth.apiHost = LocalStore.getServerUrl();
						win3.webContents.send('timer_tracker_show', auth);
						win3.show();
					}
				}
			},
			{
				id: '2',
				label: 'Stop Tracking Time',
				enabled: false,
				click(menuItem) {
					win3.show();
					win3.webContents.send('stop_from_tray');
				}
			},
			{
				id: '3',
				label: 'Open Time Tracker',
				enabled: true,
				click(menuItem) {
					win3.webContents.send(
						'timer_tracker_show',
						LocalStore.beforeRequestParams()
					);
					win3.show();
				}
			},
			{
				id: '4',
				label: 'Setting',
				click() {
					win2.webContents.send('open_setting_page');
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

		const periodicUpdate = () => {
			timerHandler.updateTime(win2, knex);
		};
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
			console.log('update time view');
			contextMenu[0].label = `Now tracking time - ${arg.hours}h ${arg.minutes}m`;
			this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
		});
		console.log(this.tray);
	}
}
