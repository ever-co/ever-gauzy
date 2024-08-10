import { BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { LocalStore } from './desktop-store';
import { createSettingsWindow, createAboutWindow } from '@gauzy/desktop-window';
import { TranslateService } from './translation';
import { TimerService } from './offline';

export class AppMenu {
	public menu: MenuItemConstructorOptions[] = [];
	constructor(timeTrackerWindow, settingsWindow, updaterWindow, knex, windowPath, serverWindow?, isZoomVisible?) {
		const isZoomEnabled = isZoomVisible;
		this.menu = [
			{
				label: 'Gauzy',
				submenu: [
					{
						id: 'gauzy-about',
						label: TranslateService.instant('MENU.ABOUT'),
						enabled: true,
						async click() {
							const window: BrowserWindow = await createAboutWindow(windowPath.timeTrackerUi);
							window.show();
						}
					},
					{
						label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
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
						role: 'quit',
						label: TranslateService.instant('BUTTONS.EXIT')
					}
				]
			},
			{
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
							console.log('Last Capture Time (Desktop Menu):', lastTime);
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
							if (!settingsWindow) {
								settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi, windowPath.preloadPath);
							}
							settingsWindow.show();
							settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
							settingsWindow.webContents.send(timeTrackerWindow ? 'goto_top_menu' : 'goto_update');
							settingsWindow.webContents.send('refresh_menu');
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
			},
			{
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
			},
			{
				label: TranslateService.instant('TIMER_TRACKER.MENU.HELP'),
				submenu: [
					{
						label: TranslateService.instant('TIMER_TRACKER.MENU.LEARN_MORE'),
						click() {
							shell.openExternal(process.env.COMPANY_SITE_LINK || 'https://gauzy.co/');
						}
					},
					{
						id: 'devtools-setting',
						label: TranslateService.instant('TIMER_TRACKER.MENU.SETTING_DEV_MODE'),
						enabled: true,
						async click() {
							if (!settingsWindow) {
								settingsWindow = await createSettingsWindow(settingsWindow, windowPath.timeTrackerUi);
							}
							settingsWindow.webContents.toggleDevTools();
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
					}
				]
			}
		];
		this.build();
		if (timeTrackerWindow) {
			timeTrackerWindow.webContents.send('refresh_menu');
		}
		if (settingsWindow) {
			settingsWindow.webContents.send('refresh_menu');
		}
		if (updaterWindow) {
			updaterWindow.webContents.send('refresh_menu');
		}
	}

	public build(): void {
		Menu.setApplicationMenu(Menu.buildFromTemplate([...this.menu]));
	}
}
