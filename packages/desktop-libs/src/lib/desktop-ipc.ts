import {
	BrowserWindow,
	ipcMain,
	screen,
	desktopCapturer,
	app,
	systemPreferences,
} from 'electron';
import { TimerData } from './desktop-timer-activity';
import TimerHandler from './desktop-timer';
import moment from 'moment';
import { LocalStore } from './desktop-store';
import { notifyScreenshot, takeshot } from './desktop-screenshot';
import { resetPermissions } from 'mac-screen-capture-permissions';
import * as _ from 'underscore';
import { timeTrackerPage } from '@gauzy/desktop-window';
// Import logging for electron and override default console logging
import log from 'electron-log';
import NotificationDesktop from './desktop-notifier';
import { DesktopPowerManager } from './desktop-power-manager';
import {
	PowerManagerPreventDisplaySleep,
	PowerManagerDetectInactivity,
} from './decorators';
import { DesktopOsInactivityHandler } from './desktop-os-inactivity-handler';
import { DesktopOfflineModeHandler } from './offline/desktop-offline-mode-handler';
import { IntervalTO } from './offline/dto/interval.dto';
import { Interval, IntervalService, User, UserService } from './offline';

const timerHandler = new TimerHandler();

console.log = log.log;
Object.assign(console, log.functions);

const offlineMode = DesktopOfflineModeHandler.instance;
const userService = new UserService();
const intervalService = new IntervalService();

export function ipcMainHandler(
	store,
	startServer,
	knex,
	config,
	timeTrackerWindow
) {
	ipcMain.removeAllListeners('start_server');
	ipcMain.removeAllListeners('remove_afk_local_Data');
	ipcMain.removeAllListeners('return_time_sheet');
	ipcMain.removeAllListeners('return_toggle_api');
	ipcMain.removeAllListeners('set_project_task');
	ipcMain.removeHandler('DESKTOP_CAPTURER_GET_SOURCES');
	ipcMain.on('start_server', (event, arg) => {
		global.variableGlobal = {
			API_BASE_URL: arg.serverUrl
				? arg.serverUrl
				: arg.port
				? `http://localhost:${arg.port}`
				: `http://localhost:${config.API_DEFAULT_PORT}`,
			IS_INTEGRATED_DESKTOP: arg.isLocalServer,
		};
		startServer(arg);
	});

	ipcMain.on('remove_afk_local_Data', async (event, arg) => {
		await TimerData.deleteAfk(knex, {
			idAfk: arg.idAfk,
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
					timeLogId: arg.timeLogId,
				},
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
					timeLogId: arg.result.id,
				},
			},
			knex
		);
	});

	ipcMain.on('failed_synced_timeslot', async (event, arg) => {
		try {
			const interval = new Interval(arg.params);
			interval.screenshots = arg.params.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = false;
			await intervalService.create(interval.toObject());
			await countIntervalQueue(timeTrackerWindow, false);
		} catch (error) {
			console.error('Error to save timeslot', error);
		}
	});

	ipcMain.on('set_project_task', (event, arg) => {
		event.sender.send('set_project_task_reply', arg);
	});

	ipcMain.on('time_tracker_ready', async (event, arg) => {
		const auth = LocalStore.getStore('auth');
		if (auth && auth.userId) {
			const lastTime = await TimerData.getLastCaptureTimeSlot(
				knex,
				LocalStore.beforeRequestParams()
			);
			console.log('Last Capture Time (Desktop IPC):', lastTime);
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null,
			});
		}
		// check connectivity seven seconds after start
		setTimeout(async () => {
			try {
				await offlineMode.connectivity();
				await countIntervalQueue(timeTrackerWindow, false);
			} catch (error) {
				console.log('[ERROROFFLINECHECK001]', error);
			}
		}, 7000);
	});

	ipcMain.on('screen_shoot', async (event, arg) => {
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
				if (isScreenUnauthorised()) {
					event.sender.send('stop_from_tray', {
						quitApp: true,
					});
					// Trigger macOS to ask user for screen capture permission
					try {
						await desktopCapturer.getSources({
							types: ['screen'],
						});
					} catch (_) {
						// softfail
					}
				}
			}
		} catch (error) {
			console.log('error opening permission', error.message);
		}
	});

	ipcMain.on('reset_permissions', () => {
		if (process.platform === 'darwin') {
			if (isScreenUnauthorised()) {
				const name = app.getName().split('-').join('');
				resetPermissions({ bundleId: 'com.ever.' + name });
			}
		}
	});

	ipcMain.on('auth_failed', (event, arg) => {
		event.sender.send('show_error_message', arg.message);
	});

	ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', (event, opts) =>
		desktopCapturer.getSources(opts)
	);
}

function isScreenUnauthorised() {
	return systemPreferences.getMediaAccessStatus('screen') !== 'granted';
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
	let powerManager;
	let powerManagerPreventSleep;
	let powerManagerDetectInactivity;

	ipcMain.on('update-synced', async (event, arg: IntervalTO) => {
		try {
			const interval = new Interval(arg);
			await intervalService.synced(interval);
			await countIntervalQueue(timeTrackerWindow, true);
		} catch (error) {
			console.log('Error', error);
		}
	});

	offlineMode.on('offline', async () => {
		console.log('Offline mode triggered...');
		timeTrackerWindow.webContents.send('offline-handler', true);
	});

	offlineMode.on('connection-restored', async () => {
		console.log('Api connected...');
		try {
			timeTrackerWindow.webContents.send('offline-handler', false);
			await countIntervalQueue(timeTrackerWindow, false);
			const intervals = await intervalService.backedUpAllNoSynced();
			intervals.forEach((interval: IntervalTO) => {
				interval.activities = JSON.parse(interval.activities as any);
				interval.screenshots = JSON.parse(interval.screenshots as any);
				const intervalToSync = new Interval(interval);
				timeTrackerWindow.webContents.send('backup-no-synced', {
					...intervalToSync.toObject(),
					id: intervalToSync.id,
				});
			});
		} catch (error) {
			console.log('Error', error);
		}
	});

	offlineMode.trigger();

	ipcMain.on('start_timer', (event, arg) => {
		powerManager = new DesktopPowerManager(timeTrackerWindow);
		powerManagerPreventSleep = new PowerManagerPreventDisplaySleep(
			powerManager
		);
		powerManagerDetectInactivity = new PowerManagerDetectInactivity(
			powerManager
		);
		new DesktopOsInactivityHandler(powerManagerDetectInactivity);
		const setting = LocalStore.getStore('appSetting');
		log.info(`Timer Start: ${moment().format()}`);
		store.set({
			project: {
				projectId: arg.projectId,
				taskId: arg.taskId,
				note: arg.note,
				aw: arg.aw,
				organizationContactId: arg.organizationContactId,
			},
		});
		timerHandler.startTimer(
			setupWindow,
			knex,
			timeTrackerWindow,
			arg.timeLog
		);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting'),
		});
		if (setting && setting.preventDisplaySleep)
			powerManagerPreventSleep.start();
		powerManagerDetectInactivity.startInactivityDetection();
	});

	ipcMain.on('data_push_activity', async (event, arg) => {
		const collections = arg.windowEvent.map((item) => {
			return {
				eventId: item.id,
				timerId: arg.timerId,
				duration: item.duration,
				data: JSON.stringify(item.data),
				created_at: new Date(),
				updated_at: new Date(),
				activityId: null,
				type: arg.type,
			};
		});
		if (collections.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					data: collections,
					type: 'window-events',
				},
				knex
			);
		}
	});

	ipcMain.on('remove_aw_local_data', async (event, arg) => {
		if (arg.idsAw && arg.idsAw.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					type: 'remove-window-events',
					data: arg.idsAw,
				},
				knex
			);
		}
	});

	ipcMain.on('remove_wakatime_local_data', async (event, arg) => {
		if (arg.idsWakatime && arg.idsWakatime.length > 0) {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					type: 'remove-wakatime-events',
					data: arg.idsWakatime,
				},
				knex
			);
		}
	});

	ipcMain.on('stop_timer', async (event, arg) => {
		log.info(`Timer Stop: ${moment().format()}`);
		timerHandler.stopTime(
			setupWindow,
			timeTrackerWindow,
			knex,
			arg.quitApp
		);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting'),
		});
		if (powerManagerPreventSleep) powerManagerPreventSleep.stop();
		if (powerManagerDetectInactivity)
			powerManagerDetectInactivity.stopInactivityDetection();
		await syncIntervalQueue(timeTrackerWindow);
	});

	ipcMain.on('return_time_slot', async (event, arg) => {
		console.log(
			`Return To Timeslot Last Timeslot ID: ${arg.timeSlotId} and Timer ID: ${arg.timerId}`
		);
		timerHandler.createQueue(
			'sqlite-queue',
			{
				data: {
					id: arg.timerId,
					timeSlotId: arg.timeSlotId,
				},
				type: 'update-timer-time-slot',
			},
			knex
		);

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
			timeLogs = _.sortBy(timeLogs, 'recordedAt').reverse();

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
				notifyScreenshot(
					notificationWindow,
					arg,
					windowPath,
					soundPath,
					timeTrackerWindow
				);
			}
		}
	});

	ipcMain.on('save_screen_shoot', (event, arg) => {
		takeshot(
			timeTrackerWindow,
			arg,
			notificationWindow,
			false,
			windowPath,
			soundPath
		);
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
					message: arg.message,
				},
			},
			knex
		);
	});

	ipcMain.on('save_temp_screenshot', async (event, arg) => {
		takeshot(
			timeTrackerWindow,
			arg,
			notificationWindow,
			true,
			windowPath,
			soundPath
		);
	});

	ipcMain.on('save_temp_img', async (event, arg) => {
		await timerHandler.createQueue(
			'sqlite-queue',
			{
				type: 'save-failed-request',
				data: arg,
			},
			knex
		);
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
				additionalSetting: addSetting,
			});
			settingWindow.webContents.send('goto_top_menu');
		}, 500);
	});

	ipcMain.on('switch_aw_option', (event, arg) => {
		const settings = LocalStore.getStore('appSetting');
		timeTrackerWindow.webContents.send('update_setting_value', settings);
	});

	ipcMain.on('logout_desktop', async (event, arg) => {
		try {
			console.log('masuk logout main');
			timeTrackerWindow.webContents.send('logout');
			await userService.remove();
		} catch (error) {
			console.log('Error', error);
		}
	});

	ipcMain.on('navigate_to_login', () => {
		timeTrackerWindow.loadURL(timeTrackerPage(windowPath.timeTrackerUi));
		LocalStore.updateAuthSetting({ isLogout: true });
		settingWindow.webContents.send('logout_success');
	});

	ipcMain.on('expand', (event, arg) => {
		const isLinux = process.platform === 'linux';
		const display = screen.getPrimaryDisplay();
		const { height } = display.workArea;
		const maxHeight = height <= 768 ? height - 20 : 768;
		const maxWidth = height < 768 ? 360 - 50 : 360;
		const widthLarge = height < 768 ? 1024 - 50 : 1024;
		if (arg) {
			try {
				isLinux
					? resizeLinux(timeTrackerWindow, arg)
					: timeTrackerWindow.setSize(widthLarge, maxHeight, true);
				timeTrackerWindow.center();
			} catch (error) {
				console.log('error on change window width', error);
			}
		} else {
			try {
				isLinux
					? resizeLinux(timeTrackerWindow, arg)
					: timeTrackerWindow.setSize(maxWidth, maxHeight, true);
			} catch (error) {
				console.log('error on change window width', error);
			}
		}
		event.sender.send('expand', arg);
	});

	function resizeLinux(window: BrowserWindow, isExpanded: boolean): void {
		const width = isExpanded ? 1024 : 360;
		const height = 748;
		window.setMinimumSize(width, height);
		window.setSize(width, height, true);
		window.setResizable(false);
	}

	ipcMain.on('timer_stopped', (event, arg) => {
		timeTrackerWindow.webContents.send('timer_already_stop');
	});

	ipcMain.on('refresh-timer', async (event) => {
		const lastTime = await TimerData.getLastCaptureTimeSlot(
			knex,
			LocalStore.beforeRequestParams()
		);
		console.log(
			'Last Capture Time Start Tracking Time (Desktop Try):',
			lastTime
		);
		event.sender.send('timer_tracker_show', {
			...LocalStore.beforeRequestParams(),
			timeSlotId: lastTime ? lastTime.timeslotId : null,
		});
		await syncIntervalQueue(timeTrackerWindow);
	});

	ipcMain.on('aw_status', (event, arg) => {
		LocalStore.updateApplicationSetting({
			awIsConnected: arg,
		});
	});

	ipcMain.on('update_timer_auth_config', (event, arg) => {
		LocalStore.updateAuthSetting({ ...arg });
	});

	ipcMain.on('auth_success', async (event, arg) => {
		try {
			const user = new User(arg.user);
			user.remoteId = arg.user.id;
			user.organizationId = arg.organizationId;
			await userService.save(user.toObject());
		} catch (error) {
			console.log('Error on save user', error);
		}
	});
}

export function removeMainListener() {
	const mainListeners = [
		'update_timer_auth_config',
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
		'request_permission',
	];

	mainListeners.forEach((listener) => {
		ipcMain.removeAllListeners(listener);
	});
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
		'timer_stopped',
		'reset_permissions',
	];
	timerListeners.forEach((listener) => {
		ipcMain.removeAllListeners(listener);
	});
}

async function syncIntervalQueue(window: BrowserWindow) {
	try {
		await offlineMode.connectivity();
		if (offlineMode.enabled) return;
		const intervals = await intervalService.backedUpAllNoSynced();
		intervals.forEach((interval: IntervalTO) => {
			interval.activities = JSON.parse(interval.activities as any);
			interval.screenshots = JSON.parse(interval.screenshots as any);
			const intervalToSync = new Interval(interval);
			window.webContents.send('backup-no-synced', {
				...intervalToSync.toObject(),
				id: intervalToSync.id,
			});
		});
	} catch (error) {
		console.log('Error', error);
	}
}

async function countIntervalQueue(window: BrowserWindow, isSyncing: boolean) {
	const total = await intervalService.countNoSynced();
	window.webContents.send('count-synced', {
		queue: total,
		isSyncing: isSyncing,
	});
}
