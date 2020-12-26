import { app, Menu, remote } from 'electron';
import { LocalStore } from './getSetStore';
import { TimerData } from '../local-data/timer';
import { createSettingsWindow } from '../window/settings';
export default class AppMenu {
	constructor(timeTrackerWindow, settingsWindow, updaterWindow, knex) {
		const menu = Menu.buildFromTemplate([
			{
				label: 'Gauzy',
				submenu: [
					{ role: 'about', label: 'About' },
					{ type: 'separator' },
					{ type: 'separator' },
					{ role: 'quit', label: 'Exit' }
				]
			},
			{
				label: 'Window',
				submenu: [
					{
						id: 'window-time-track',
						label: 'Time Tracker',
						enabled: false,
						visible:
							LocalStore.getStore('configs') &&
							LocalStore.getStore('configs').timeTrackerWindow,
						click() {
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
						id: 'window-setting',
						label: 'Setting',
						enabled: false,
						click() {
							const appSetting = LocalStore.getStore(
								'appSetting'
							);
							const config = LocalStore.getStore('configs');
							if (!settingsWindow) {
								settingsWindow = createSettingsWindow(
									settingsWindow
								);
							}
							settingsWindow.show();
							setTimeout(() => {
								settingsWindow.webContents.send('app_setting', {
									setting: appSetting,
									config: config
								});
								settingsWindow.webContents.send(
									'goto_top_menu'
								);
							}, 500);
						}
					}
					// {
					// 	id: 'devtools',
					// 	label: 'DevTool',
					// 	enabled: true,
					// 	click() {
					// 		settingsWindow.webContents.toggleDevTools();
					// 	}
					// }
				]
			},
			{
				label: 'Help',
				submenu: [{ label: 'Learn More' }]
			}
		]);
		Menu.setApplicationMenu(menu);
	}
}
