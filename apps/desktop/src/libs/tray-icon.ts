import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
const Store = require('electron-store');
import NotificationDesktop from './notifier';
import TimerHandler from './timer';
import { LocalStore } from './getSetStore';

export default class TrayIcon {
	tray: Tray;
	constructor(win2, knex, win3) {
		const timerHandler = new TimerHandler();
		const store = new Store();
		const notificationDesktop = new NotificationDesktop();
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
						notificationDesktop.startTimeNotification();
						timerHandler.startTimer(win2, knex, win3);
						const timeMenu = menuItem.menu.getMenuItemById('0');
						getTime(menuItem);
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
					timerHandler.stopTime();
				}
			},
			{
				id: '3',
				label: 'Open Time Tracker',
				enabled: true,
				click(menuItem) {
					const auth = store.get('auth');
					auth.apiHost = LocalStore.getServerUrl();
					win3.webContents.send('timer_tracker_show', auth);
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
		const getTime = (menuItems) => {
			timerHandler.updateTime(win2, knex);
		};
		this.tray.setContextMenu(contextMenu);
		console.log(this.tray);
	}
}
