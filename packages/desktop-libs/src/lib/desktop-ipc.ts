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
import {
	Interval,
	IntervalService,
	Timer,
	TimerService,
	TimerTO,
	User,
	UserService,
} from './offline';

const timerHandler = new TimerHandler();

console.log = log.log;
Object.assign(console, log.functions);

const offlineMode = DesktopOfflineModeHandler.instance;
const userService = new UserService();
const intervalService = new IntervalService();
const timerService = new TimerService();

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
			IS_INTEGRATED_DESKTOP: arg.isLocalServer
		};
		startServer(arg);
	});

	ipcMain.on('remove_afk_local_Data', async (event, arg) => {
		try {
			await TimerData.deleteAfk(knex, {
				idAfk: arg.idAfk
			});
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('return_time_sheet', async (event, arg) => {
		try {
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
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('return_toggle_api', async (event, arg) => {
		try {
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
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('failed_synced_timeslot', async (event, arg) => {
		try {
			const interval = new Interval(arg.params);
			interval.screenshots = arg.params.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = false;
			await intervalService.create(interval.toObject());
			await countIntervalQueue(timeTrackerWindow, false);
			await latestScreenshots(timeTrackerWindow);
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
			try {
				const user = await userService.retrieve();
				console.log('Current User', user);
				if (!user || auth.userId !== user.remoteId) {
					timeTrackerWindow.webContents.send('logout');
				}
			} catch (error) {
				try {
					const userService = new UserService();
					const user = new User({ ...auth });
					user.remoteId = auth.userId;
					user.organizationId = auth.organizationId;
					await userService.save(user.toObject());
				} catch (error) {
					timeTrackerWindow.webContents.send('logout');
				}
			}
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

		// check connectivity five seconds after start
		setTimeout(async () => {
			try {
				await offlineMode.connectivity();
				await countIntervalQueue(timeTrackerWindow, false);
				await sequentialSyncQueue(timeTrackerWindow);
				await latestScreenshots(timeTrackerWindow);
			} catch (error) {
				console.log('[ERROR_OFFLINE_CHECK]', error);
			}
		}, 5500);
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
				if (isScreenUnauthorized()) {
					event.sender.send('stop_from_tray', {
						quitApp: true
					});
					// Trigger macOS to ask user for screen capture permission
					try {
						await desktopCapturer.getSources({
							types: ['screen']
						});
					} catch (_) {
						// soft fail
					}
				}
			}
		} catch (error) {
			console.log('error opening permission', error.message);
		}
	});

	ipcMain.on('reset_permissions', () => {
		if (process.platform === 'darwin') {
			if (isScreenUnauthorized()) {
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

function isScreenUnauthorized() {
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

	ipcMain.on('update-synced-timer', async (event, arg) => {
		try {
			await timerService.update(
				new Timer({
					id: arg.id,
					timelogId: arg.lastTimer.id,
					timesheetId: arg.lastTimer.timesheetId,
					synced: true,
					...(arg.lastTimer.startedAt && { startedAt: new Date(arg.lastTimer.startedAt) })
				})
			);
		} catch (error) {
			console.log('[UPDATE_SYNCED_TIME_ERROR]', error);
		}
	});

	ipcMain.on('create-synced-interval', async (_event, arg) => {
		try {
			const interval = new Interval(arg);
			interval.screenshots = arg.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = true;
			await intervalService.create(interval.toObject());
			await latestScreenshots(timeTrackerWindow);
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
			await sequentialSyncQueue(timeTrackerWindow);
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
				organizationContactId: arg.organizationContactId
			}
		});
		timerHandler.startTimer(setupWindow, knex, timeTrackerWindow, arg.timeLog);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
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
				type: arg.type
			};
		});
		if (collections.length > 0) {
			try {
				await timerHandler.createQueue(
					'sqlite-queue',
					{
						data: collections,
						type: 'window-events'
					},
					knex
				);
			} catch (error) {
				console.log('ERROR', error);
			}
		}
	});

	ipcMain.on('remove_aw_local_data', async (event, arg) => {
		try {
			if (arg.idsAw && arg.idsAw.length > 0) {
				await timerHandler.createQueue(
					'sqlite-queue',
					{
						type: 'remove-window-events',
						data: arg.idsAw
					},
					knex
				);
			}
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('remove_wakatime_local_data', async (event, arg) => {
		try {
			if (arg.idsWakatime && arg.idsWakatime.length > 0) {
				await timerHandler.createQueue(
					'sqlite-queue',
					{
						type: 'remove-wakatime-events',
						data: arg.idsWakatime
					},
					knex
				);
			}
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('stop_timer', async (event, arg) => {
		log.info(`Timer Stop: ${moment().format()}`);
		timerHandler.stopTime(setupWindow, timeTrackerWindow, knex, arg.quitApp);
		settingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
		});
		if (powerManagerPreventSleep) powerManagerPreventSleep.stop();
		if (powerManagerDetectInactivity)
			powerManagerDetectInactivity.stopInactivityDetection();
	});

	ipcMain.on('return_time_slot', async (event, arg) => {
		try {
			console.log(
				`Return To Timeslot Last Timeslot ID: ${arg.timeSlotId} and Timer ID: ${arg.timerId}`
			);
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					data: {
						id: arg.timerId,
						timeSlotId: arg.timeSlotId,
					},
					type: 'update-timer-time-slot'
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
			if (!arg.quitApp) {
				console.log('TimeLogs:', arg.timeLogs);

				// create new timer entry after create timeslot
				let timeLogs = arg.timeLogs;
				timeLogs = _.sortBy(timeLogs, 'recordedAt').reverse();

				const [timeLog] = timeLogs;
				await timerHandler.createTimer(knex, timeLog);
			}
		} catch (error) {
			console.log('ERROR', error);
		}
		/* TODO: was removed, why? moved to func takeScreenshotActivities on desktop-timer
				this fix notify popup screenshot on time
			switch (
					appSetting.SCREENSHOTS_ENGINE_METHOD ||
					config.SCREENSHOTS_ENGINE_METHOD
				) {
					case 'ElectronDesktopCapturer':
						timeTrackerWindow.webContents.send('take_screenshot', {
							timeSlotId: arg.timeSlotId,
							screenSize: screen.getPrimaryDisplay().workAreaSize
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

	ipcMain.on('save_screen_shoot', async (event, arg) => {
		try {
			await takeshot(
				timeTrackerWindow,
				arg,
				notificationWindow,
				false,
				windowPath,
				soundPath
			);
		} catch (error) {
			console.log('ERROR_TAKE_SHOT', error);
		}
	});

	ipcMain.on('show_image', (event, arg) => {
		imageView.show();
		imageView.webContents.send('show_image', arg);
	});

	ipcMain.on('close_image_view', () => {
		imageView.hide();
	});

	ipcMain.on('failed_save_time_slot', async (event, arg) => {
		try {
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
			);
		} catch (error) {
			console.error('ERROR_ON_CREATE_QUEUE', error);
		}
	});

	ipcMain.on('save_temp_screenshot', async (event, arg) => {
		try {
			await takeshot(
				timeTrackerWindow,
				arg,
				notificationWindow,
				true,
				windowPath,
				soundPath
			);
		} catch (error) {
			console.log('ERROR_ON_TAKE_SHOT', error);
		}
	});

	ipcMain.on('save_temp_img', async (event, arg) => {
		try {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					type: 'save-failed-request',
					data: arg
				},
				knex
			);
		} catch (error) {
			console.log('ERROR_ON_CREATE_QUEUE', error);
		}
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

	ipcMain.on('logout_desktop', async (event, arg) => {
		try {
			console.log('masuk logout main');
			await userService.remove();
			timeTrackerWindow.webContents.send('logout', arg);
		} catch (error) {
			console.log('Error', error);
		}
	});

	ipcMain.on('navigate_to_login', () => {
		try {
			if (timeTrackerWindow) {
				timeTrackerWindow.loadURL(timeTrackerPage(windowPath.timeTrackerUi));
			}
			LocalStore.updateAuthSetting({ isLogout: true });
			if (settingWindow) {
				settingWindow.webContents.send('logout_success');
			}
		} catch (error) {
			console.log('ERROR', error);
		}
	});

	ipcMain.on('expand', (event, arg) => {
		try {
			resizeWindow(timeTrackerWindow, arg);
			event.sender.send('expand', arg);
		} catch (error) {
			console.log('error on change window width', error);
		}
	});

	function resizeWindow(window: BrowserWindow, isExpanded: boolean): void {
		const display = screen.getPrimaryDisplay();
		const { height, width } = display.workArea;
		const maxHeight = height <= 768 ? height - 20 : 768;
		const maxWidth = height < 768 ? 360 - 50 : 360;
		const widthLarge = height < 768 ? 1024 - 50 : 1024;
		switch (process.platform) {
			case 'linux':
				{
					const wx = isExpanded ? 1024 : 360;
					const hx = 748;
					window.setMinimumSize(wx, hx);
					window.setSize(wx, hx, true);
					window.setResizable(false);
				}
				break;
			case 'darwin':
				{
					window.setSize(isExpanded ? widthLarge : maxWidth, maxHeight, true);
					if (isExpanded) window.center();
				}
				break;
			default:
				{
					window.setBounds(
						{
							width: isExpanded ? widthLarge : maxWidth,
							height: maxHeight,
							x: (width - (isExpanded ? widthLarge : maxWidth)) * 0.5,
							y: (height - maxHeight) * 0.5
						},
						true
					);
				}
				break;
		}
	}

	ipcMain.on('timer_stopped', (event, arg) => {
		timeTrackerWindow.webContents.send('timer_already_stop');
	});

	ipcMain.on('refresh-timer', async (event) => {
		try {
			const lastTime = await TimerData.getLastCaptureTimeSlot(
				knex,
				LocalStore.beforeRequestParams()
			);
			console.log(
				'Last Capture Time Start Tracking Time (Desktop Try):',
				lastTime
			);
			if (!isQueueThreadTimerLocked) {
				await sequentialSyncQueue(timeTrackerWindow);
			}
			await syncIntervalQueue(timeTrackerWindow);
			await latestScreenshots(timeTrackerWindow);
			await countIntervalQueue(timeTrackerWindow, false);
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null
			});
		} catch (error) {
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: null
			});
			console.log('ERROR_ON_REFRESH', error);
		}
	});

	ipcMain.on('aw_status', (event, arg) => {
		LocalStore.updateApplicationSetting({
			awIsConnected: arg
		});
	});

	ipcMain.on('update_timer_auth_config', (event, arg) => {
		LocalStore.updateAuthSetting({ ...arg });
	});

	ipcMain.on('set_tp_aw', (event, arg) => {
		const projectInfo = LocalStore.getStore('project');
		store.set({
			project: {
				...projectInfo,
				aw: arg
			},
		});
	});

	ipcMain.on('finish-synced-timer', async (event, arg) => {
		const previous = queueSync;
		await countIntervalQueue(timeTrackerWindow, false);
		const total = await intervalService.countNoSynced();
		if (total > 0 && !isQueueThreadIntervalLocked && previous !== total) {
			const lastTimer = await timerService.findLastOne();
			if (lastTimer.synced) {
				const intervals = await intervalService.backedUpAllNoSynced();
				isQueueThreadIntervalLocked = true;
				isQueueThreadTimerLocked = true
				timeTrackerWindow.webContents.send('backup-no-synced', [
					intervals,
					lastTimer
				]);
			}
			return;
		}
		isQueueThreadIntervalLocked = false;
		isQueueThreadTimerLocked = false;
		console.log('-----> FINISH SYNC <------');
	});

	ipcMain.on('notify', (event, notification) => {
		const notify = new NotificationDesktop();
		notify.customNotification(notification.message, notification.text);
	})

	ipcMain.on('update_session', (event, timer: TimerTO) => {
		timerHandler.timeStart = moment(timer.startedAt);
	})
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
		'request_permission'
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
		'reset_permissions'
	];
	timerListeners.forEach((listener) => {
		ipcMain.removeAllListeners(listener);
	});
}

let isQueueThreadTimerLocked = false;

async function sequentialSyncQueue(window: BrowserWindow) {
	try {
		await offlineMode.connectivity();
		if (offlineMode.enabled) return;
		isQueueThreadTimerLocked = true;
		const timers = await timerService.findToSynced();
		const timersToSynced: {
			timer: TimerTO;
			intervals: IntervalTO[];
		}[] = [];
		console.log('---> PREPARE TO SYNC <---');
		let count = timers.length;
		for (const timer of timers) {
			console.log('waiting...', count);
			const sequence = await timer;
			timersToSynced.push(sequence);
			count--;
		}
		console.log('---> SEND TO SYNC <---');
		if (timersToSynced.length > 0) {
			window.webContents.send('backup-timers-no-synced', timersToSynced);
		} else {
			isQueueThreadTimerLocked = false;
		}
	} catch (error) {
		console.log('Error', error);
	}
}

let isQueueThreadIntervalLocked = false;
async function syncIntervalQueue(window: BrowserWindow) {
	try {
		await offlineMode.connectivity();
		if (offlineMode.enabled) return;
		const lastTimer = await timerService.findLastOne();
		if (
			!lastTimer.isStartedOffline &&
			!lastTimer.isStoppedOffline &&
			!lastTimer.synced &&
			!isQueueThreadIntervalLocked
		) {
			isQueueThreadIntervalLocked = true;
			const intervals = await intervalService.backedUpAllNoSynced();
			window.webContents.send('backup-no-synced', [intervals, lastTimer]);
		}
	} catch (error) {
		console.log('Error', error);
	}
}

let queueSync = Infinity;

async function countIntervalQueue(window: BrowserWindow, isSyncing: boolean) {
	queueSync = await intervalService.countNoSynced();
	if (queueSync < 1) isQueueThreadTimerLocked = false;
	window.webContents.send('count-synced', {
		queue: queueSync,
		isSyncing: isSyncing
	});
}

async function latestScreenshots(window: BrowserWindow): Promise<void> {
	window.webContents.send(
		'latest_screenshots',
		await intervalService.screenshots()
	);
}
