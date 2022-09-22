import {BrowserWindow, ipcMain, screen, systemPreferences} from 'electron';
import {TimerData} from './desktop-timer-activity';
import TimerHandler from './desktop-timer';
import moment from 'moment';
import {LocalStore} from './desktop-store';
import {takeshot, notifyScreenshot} from './desktop-screenshot';
import {
	openSystemPreferences
} from 'mac-screen-capture-permissions';
import * as _ from 'underscore';
import {
	timeTrackerPage
} from '@gauzy/desktop-window';

const timerHandler = new TimerHandler();

// Import logging for electron and override default console logging
import log from 'electron-log';
import NotificationDesktop from './desktop-notifier';
console.log = log.log;
Object.assign(console, log.functions);


export function ipcMainHandler(store, startServer, knex, config, timeTrackerWindow) {
	ipcMain.removeAllListeners('start_server');
	ipcMain.removeAllListeners('remove_afk_local_Data');
	ipcMain.removeAllListeners('return_time_sheet');
	ipcMain.removeAllListeners('return_toggle_api');
	ipcMain.removeAllListeners('set_project_task');
	ipcMain.on('start_server', (event, arg) => {
		global.variableGlobal = {
			API_BASE_URL: arg.serverUrl
				? arg.serverUrl
				: arg.port
				? `http://localhost:${arg.port}`
				: `http://localhost:${config.API_DEFAULT_PORT}`,
			IS_INTEGRATED_DESKTOP: arg.isLocalServer
		};
		startServer(arg);
	});

	ipcMain.on('remove_afk_local_Data', async (event, arg) => {
		await TimerData.deleteAfk(knex, {
			idAfk: arg.idAfk
		});
	});

	ipcMain.on('return_time_sheet', async (event, arg) => {
		await timerHandler.createQueue(
			'sqlite-queue',
			{
				type: 'update-timer-time-slot',
				data: {
					id: arg.timerId,
					timeSheetId: arg.timeSheetId,
					timeLogId: arg.timeLogId
				}
			},
			knex
		);
	});

	ipcMain.on('return_toggle_api', async (event, arg) => {
		await timerHandler.createQueue(
			'sqlite-queue',
			{
				type: 'update-timer-time-slot',
				data: {
					id: arg.timerId,
					timeLogId: arg.result.id
				}
			},
			knex
		);
	});

	ipcMain.on('set_project_task', (event, arg) => {
		event.sender.send('set_project_task_reply', arg);
	});

	ipcMain.on('time_tracker_ready', async (event, arg) => {
		const auth = LocalStore.getStore('auth');
		if (auth && auth.userId) {
			const [lastTime] = await TimerData.getLastCaptureTimeSlot(
				knex,
				LocalStore.beforeRequestParams()
			);
			console.log('Last Capture Time (Desktop IPC):', lastTime);
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeSlotId : null
			});
		}
	});

	ipcMain.on('screen_shoot', (event, arg) => {
		log.info(`Taken Screenshot: ${moment().format()}`);
		event.sender.send('take_screen_shoot');
	});

	ipcMain.on('get_last_screen_capture', (event, arg) => {
		log.info(`Get Last Screenshot: ${moment().format()}`);
		event.sender.send('get_last_screen');
	});

	ipcMain.on('update_app_setting', (event, arg) => {
		LocalStore.updateApplicationSetting(arg.values);
	});

	ipcMain.on('update_project_on', (event, arg) => {
		LocalStore.updateConfigProject(arg);
	});

	ipcMain.on('request_permission', async (event) => {
		try {
			if (process.platform === 'darwin') {
				const screenCapturePermission = systemPreferences.getMediaAccessStatus('screen');
				if (screenCapturePermission !== 'granted') {
					await openSystemPreferences();
				}
			}
		} catch (error) {
			console.log('error opening permission', error.message);
		}
	});

	ipcMain.on('auth_failed', (event, arg) => {
		event.sender.send('show_error_message', arg.message);
	})
}

export function ipcTimer(
	store,
	knex,
	setupWindow,
	timeTrackerWindow,
	notificationWindow,
	settingWindow,
	imageView,
	config,
	createSettingsWindow,
	windowPath,
	soundPath
) {
	ipcMain.on('start_timer', (event, arg) => {
		log.info(`Timer Start: ${moment().format()}`);
		store.set({
			project: {
				projectId: arg.projectId,
				taskId: arg.taskId,
				note: arg.note,
				aw: arg.aw,
				organizationContactId: arg.organizationContactId
			}
		});
		timerHandler.startTimer(
			setupWindow,
			knex,
			timeTrackerWindow,
			arg.timeLog
		);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
		});
	});

	ipcMain.on('data_push_activity', async (event, arg) => {

		const collections = arg.windowEvent.map((item) => {
			return {
				eventId: item.id,
				timerId: arg.timerId,
				durations: item.duration,
				data: JSON.stringify(item.data),
				created_at: new Date(),
				updated_at: new Date(),
				activityId: null,
				type: arg.type
			}
		});
		if (collections.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					data: collections,
					type: 'window-events'
				}, knex);
		}
	});

	ipcMain.on('remove_aw_local_data', async (event, arg) => {
		if (arg.idsAw && arg.idsAw.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				 {
					 type: 'remove-window-events',
					 data: arg.idsAw
				 }, knex);
		}
	});

	ipcMain.on('remove_wakatime_local_data', async (event, arg) => {
		if (arg.idsWakatime && arg.idsWakatime.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					type: 'remove-wakatime-events',
					data: arg.idsWakatime
				},
				knex
			)
		}
	});

	ipcMain.on('stop_timer', (event, arg) => {
		log.info(`Timer Stop: ${moment().format()}`);
		timerHandler.stopTime(
			setupWindow,
			timeTrackerWindow,
			knex,
			arg.quitApp
		);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
		});
	});

	ipcMain.on('return_time_slot', async (event, arg) => {
		console.log(
			`Return To Timeslot Last Timeslot ID: ${arg.timeSlotId} and Timer ID: ${arg.timerId}`
		);
		timerHandler.createQueue('sqlite-queue',
		{
			data: {
				id: arg.timerId,
				timeSlotId: arg.timeSlotId
			},
			type: 'update-timer-time-slot'
		}, knex);

		timeTrackerWindow.webContents.send(
			'refresh_time_log',
			LocalStore.beforeRequestParams()
		);
		// after update time slot do upload screenshot
		// check config
		const appSetting = LocalStore.getStore('appSetting');
		log.info(`App Setting: ${moment().format()}`, appSetting);
		log.info(`Config: ${moment().format()}`, config);

    /* TODO: was removed, why? moved to func takeScreenshotActivities on desktop-timer
		this fix notify popup screenshot on time
    switch (
			appSetting.SCREENSHOTS_ENGINE_METHOD ||
			config.SCREENSHOTS_ENGINE_METHOD
		) {
			case 'ElectronDesktopCapturer':
				timeTrackerWindow.webContents.send('take_screenshot', {
					timeSlotId: arg.timeSlotId,
					screensize: screen.getPrimaryDisplay().workAreaSize
				});
				break;
			case 'ScreenshotDesktopLib':
				captureScreen(
					timeTrackerWindow,
					notificationWindow,
					arg.timeSlotId,
					arg.quitApp,
					windowPath,
					soundPath
				);
				break;
			default:
				break;
		}
    */

		if (!arg.quitApp) {
			console.log('TimeLogs:', arg.timeLogs);

			// create new timer entry after create timeslot
			let timeLogs = arg.timeLogs;
			timeLogs = _.sortBy(timeLogs, 'createdAt').reverse();

			const [timeLog] = timeLogs;
			await timerHandler.createTimer(knex, timeLog);
		}
	});

	ipcMain.on('show_screenshot_notif_window', (event, arg) => {
		const appSetting = LocalStore.getStore('appSetting');
		const notify = new NotificationDesktop();
		if (appSetting) {
			if (appSetting.simpleScreenshotNotification) {
				notify.customNotification('Screenshot taken', 'Gauzy');
			} else if (appSetting.screenshotNotification) {
				notifyScreenshot(notificationWindow, arg, windowPath, soundPath, timeTrackerWindow);
			}
		}
	})

	ipcMain.on('save_screen_shoot', (event, arg) => {
		takeshot(timeTrackerWindow, arg, notificationWindow, false, windowPath, soundPath);
	});

	ipcMain.on('show_image', (event, arg) => {
		imageView.show();
		imageView.webContents.send('show_image', arg);
	});

	ipcMain.on('close_image_view', () => {
		imageView.hide();
	});

	ipcMain.on('failed_save_time_slot', async (event, arg) => {
		/* save failed request time slot */
		await timerHandler.createQueue(
			'sqlite-queue',
			{
				type: 'save-failed-request',
				data: {
					type: 'timeslot',
					params: arg.params,
					message: arg.message
				}
			},
			knex
		)
	});

	ipcMain.on('save_temp_screenshot', async (event, arg) => {
		takeshot(timeTrackerWindow, arg, notificationWindow, true, windowPath, soundPath);
	});

	ipcMain.on('save_temp_img', async (event, arg) => {
		await timerHandler.createQueue(
			'sqlite-queue',
			{
				type: 'save-failed-request',
				data: arg
			},
			knex
		)
	});

	ipcMain.on('open_setting_window', (event, arg) => {
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');
		const auth = LocalStore.getStore('auth');
		const addSetting = LocalStore.getStore('additionalSetting');

		if (!settingWindow) {
			settingWindow = createSettingsWindow(
				settingWindow,
				windowPath.timeTrackerUi
			);
		}
		settingWindow.show();
		setTimeout(() => {
			settingWindow.webContents.send('app_setting', {
				setting: appSetting,
				config: config,
				auth,
				additionalSetting: addSetting
			});
			settingWindow.webContents.send('goto_top_menu');
		}, 500);
	});

	ipcMain.on('switch_aw_option', (event, arg) => {
		const settings = LocalStore.getStore('appSetting');
		timeTrackerWindow.webContents.send('update_setting_value', settings);
	});

	ipcMain.on('logout_desktop', (event, arg) => {
		console.log('masuk logout main');
		timeTrackerWindow.webContents.send('logout');
	})

	ipcMain.on('navigate_to_login', () => {
		timeTrackerWindow.loadURL(
			timeTrackerPage(windowPath.timeTrackerUi)
		);
		LocalStore.updateAuthSetting({ isLogout: true })
		settingWindow.webContents.send('logout_success');
	})

	ipcMain.on('expand', (event, arg) => {
		const isLinux = process.platform === 'linux';
		const display = screen.getPrimaryDisplay();
		const { width, height } = display.workArea;
		const maxHeight = height <= 768 ? height - 20 : 768;
		const maxWidth = height < 768 ? 360 - 50 : 360;
		const widthLarge = height < 768 ? 1024 - 50 : 1024;
		if (arg) {
			try {
				isLinux
					? resizeLinux(timeTrackerWindow, arg)
					: timeTrackerWindow.setBounds(
							{
								width: widthLarge,
								height: maxHeight,
								x: (width - widthLarge) * 0.5,
								y: (height - maxHeight) * 0.5
							},
							true
					  );
			} catch (error) {
				console.log('error on change window width', error);
			}
		} else {
			try {
				isLinux
					? resizeLinux(timeTrackerWindow, arg)
					: timeTrackerWindow.setBounds(
							{
								width: maxWidth,
								height: maxHeight,
								x: (width - maxWidth) * 0.5,
								y: (height - maxHeight) * 0.5
							},
							true
					  );
			} catch (error) {
				console.log('error on change window width', error);
			}
		}
		event.sender.send('expand', arg);
	});

	function resizeLinux(window: BrowserWindow, isExpanded: boolean): void {
		const width = isExpanded ? 1024: 360;
		const height = 748;
		window.setMinimumSize(width, height);
		window.setSize(width, height, true);
		window.setResizable(false);
	}

	ipcMain.on('timer_stopped', (event, arg) => {
		timeTrackerWindow.webContents.send('timer_already_stop');
	})

	ipcMain.on('refresh-timer', async (event) => {
		const [ lastTime ] = await TimerData.getLastCaptureTimeSlot(
			knex,
			LocalStore.beforeRequestParams()
		);
		console.log('Last Capture Time Start Tracking Time (Desktop Try):', lastTime);
		event.sender.send(
			'timer_tracker_show',
			{
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeSlotId : null
			}
		);
	})

	ipcMain.on('aw_status', (event, arg) => {
		LocalStore.updateApplicationSetting({
			awIsConnected: arg
		});
	})
}

export function removeMainListener() {
	const mainListeners = [
		'start_server',
		'remove_afk_local_Data',
		'return_time_sheet',
		'return_toggle_api',
		'set_project_task',
		'time_tracker_ready',
		'screen_shoot',
		'get_last_screen_capture',
		'update_app_setting',
		'update_project_on',
		'request_permission'
	]

	mainListeners.forEach((listener) => {
		ipcMain.removeAllListeners(listener);
	})
}

export function removeTimerListener() {
	const timerListeners = [
		'start_timer',
		'data_push_activity',
		'remove_aw_local_data',
		'remove_wakatime_local_data',
		'stop_timer',
		'return_time_slot',
		'show_screenshot_notif_window',
		'save_screen_shoot',
		'show_image',
		'close_image_view',
		'failed_save_time_slot',
		'save_temp_screenshot',
		'save_temp_img',
		'open_setting_window',
		'switch_aw_option',
		'logout_desktop',
		'navigate_to_login',
		'expand',
		'timer_stopped'
	]
	timerListeners.forEach((listener) => {
		ipcMain.removeAllListeners(listener);
	})
}
