import { app, Menu, remote } from 'electron';
import { LocalStore } from './getSetStore';
import { TimerData } from '../local-data/timer';
import { createSettingsWindow } from '../window/settings';
export default class AppMenu {
	constructor(timeTrackerWindow, settingsWindow, knex) {
		const menu = Menu.buildFromTemplate([
			{
				label: app.getName(),
				submenu: [
					{ role: 'about' },
					{ type: 'separator' },
					{ type: 'separator' },
					{ role: 'quit' }
				]
			},
			{
				label: 'window',
				submenu: [
					{
						id: 'window-time-track',
						label: 'Time Tracker',
						enabled: false,
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
							if (!settingsWindow) {
								settingsWindow = createSettingsWindow(
									settingsWindow
								);
							}
							settingsWindow.show();
							setTimeout(() => {
								settingsWindow.webContents.send('app_setting', {
									setting: appSetting
								});
							}, 500);
						}
					}
					// {
					// 	id: 'devtools',
					// 	label: 'DevTool',
					// 	enabled: true,
					// 	click() {
					// 		timeTrackerWindow.webContents.toggleDevTools();
					// 	}
					// }
				]
			},
			{
				label: 'help',
				submenu: [{ label: 'Learn More' }]
			}
		]);
		Menu.setApplicationMenu(menu);
	}
}
