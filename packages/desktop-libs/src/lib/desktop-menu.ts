import { Menu, shell } from 'electron';
import { LocalStore } from './desktop-store';
import { TimerData } from './desktop-timer-activity';
import { createSettingsWindow } from '@gauzy/desktop-window';
export class AppMenu {
	constructor(
		timeTrackerWindow,
		settingsWindow,
		updaterWindow,
		knex,
		windowPath,
		serverWindow?
	) {
		const menu = Menu.buildFromTemplate([
			{
				label: 'Gauzy',
				submenu: [
					{ role: 'about', label: 'About' },
					{ type: 'separator' },
					{
						label: 'Check For Update',
						click() {
							const appSetting = LocalStore.getStore(
								'appSetting'
							);
							const config = LocalStore.getStore('configs');
							const addSetting = LocalStore.getStore('additionalSetting');
							if (!settingsWindow) {
								settingsWindow = createSettingsWindow(
									settingsWindow,
									windowPath.timeTrackerUi
								);
							}
							settingsWindow.show();
							setTimeout(() => {
								settingsWindow.webContents.send('goto_update');
							}, 100);
							setTimeout(() => {
								settingsWindow.webContents.send('app_setting', {
									setting: appSetting,
									config: config,
									additionalSetting: addSetting
								});
							}, 500);
						}
					},
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
								const [ lastTime ] = await TimerData.getLastCaptureTimeSlot(
									knex,
									LocalStore.beforeRequestParams()
								);
								console.log('Last Capture Time (Desktop Menu):', lastTime);
								timeTrackerWindow.webContents.send(
									'timer_tracker_show',
									{
										...LocalStore.beforeRequestParams(),
										timeSlotId: lastTime ? lastTime.timeSlotId : null
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
							const addSetting = LocalStore.getStore('additionalSetting');
							if (!settingsWindow) {
								settingsWindow = createSettingsWindow(
									settingsWindow,
									windowPath.timeTrackerUi
								);
							}
							settingsWindow.show();
							setTimeout(() => {
								settingsWindow.webContents.send('app_setting', {
									setting: appSetting,
									config: config,
									additionalSetting: addSetting
								});
								settingsWindow.webContents.send(
									timeTrackerWindow ? 'goto_top_menu' : 'goto_update'
								);
							}, 500);
						}
					}
				]
			},
			{
				label: 'Edit',
				submenu: [
				  { role: 'cut' },
				  { role: 'copy' },
				  { role: 'paste' },
				  { role: 'selectAll'}
				]
			  },
			{
				label: 'Help',
				submenu: [
					{
						label: 'Learn More',
						click() {
							shell.openExternal('https://gauzy.co/');
						}
					},
					{
						id: 'devtools-setting',
						label: 'Setting Developer Mode',
						enabled: true,
						click() {
							if (!settingsWindow) {
								settingsWindow = createSettingsWindow(
									settingsWindow,
									windowPath.timeTrackerUi
								);
							}
							settingsWindow.webContents.toggleDevTools();
						}
					},
					{
						id: 'devtools-time-tracker',
						label: 'Time Tracker Developer Mode',
						enabled: true,
						visible: timeTrackerWindow ? true : false,
						click() {
							if (timeTrackerWindow) timeTrackerWindow.webContents.toggleDevTools();
						}
					},
					{
						id: 'devtools-server',
						label: 'Server Dashboard Developer Mode',
						enabled: true,
						visible: serverWindow ? true : false,
						click() {
							if (serverWindow) serverWindow.webContents.toggleDevTools();
						}
					}
				]
			}
		]);
		Menu.setApplicationMenu(menu);
	}
}
