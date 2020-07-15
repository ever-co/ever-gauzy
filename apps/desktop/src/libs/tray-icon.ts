import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
const Store = require('electron-store');
import TimerHandler from './timer';
import { LocalStore } from './getSetStore';

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
		const contextMenu = Menu.buildFromTemplate([
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
						timerHandler.startTimer(win2, knex, win3);
						const timeMenu = menuItem.menu.getMenuItemById('0');
						getTime();
						timeMenu.visible = true;
						const stopMenu = menuItem.menu.getMenuItemById('2');
						stopMenu.enabled = true;
						menuItem.enabled = false;
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
					const startMenu = menuItem.menu.getMenuItemById('1');
					const timeView = menuItem.menu.getMenuItemById('0');
					timeView.visible = false;
					startMenu.enabled = true;
					menuItem.enabled = false;
					timerHandler.stopTime(win2, win3, knex);
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
		]);
		const getTime = () => {
			timerHandler.updateTime(win2, knex);
		};
		this.tray.setContextMenu(contextMenu);
		console.log(this.tray);
	}
}
