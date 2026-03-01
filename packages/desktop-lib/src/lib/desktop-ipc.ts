import {
	DesktopSetupConfig,
	IActivityWatchEventResult,
	TimerActionTypeEnum,
	TimerSyncStateEnum
} from '@gauzy/contracts';
import { AkitaStorageEngine, WindowManager, logger as log } from '@gauzy/desktop-core';
import { ScreenCaptureNotification } from '@gauzy/desktop-window';
import { BrowserWindow, app, desktopCapturer, ipcMain, screen, systemPreferences } from 'electron';
import * as moment from 'moment';
import * as _ from 'underscore';
import { AppWindowManager } from './app-window-manager';
import { TrackingSleepInactivity } from './contexts';
import {
	DialogStopTimerLogoutConfirmation,
	PowerManagerDetectInactivity,
	PowerManagerPreventDisplaySleep
} from './decorators';
import { DesktopDialog } from './desktop-dialog';
import NotificationDesktop from './desktop-notifier';
import { DesktopOsInactivityHandler } from './desktop-os-inactivity-handler';
import { DesktopPowerManager } from './desktop-power-manager';
import { notifyScreenshot, takeshot } from './desktop-screenshot';
import { LocalStore } from './desktop-store';
import TimerHandler from './desktop-timer';
import { UIError } from './error-handler';
import {
	ActivityWatchAfkService,
	ActivityWatchEventAdapter,
	ActivityWatchEventManager,
	ActivityWatchEventTableList
} from './integrations';
import { IDesktopEvent, IOfflineMode, IPowerManager } from './interfaces';
import {
	DesktopOfflineModeHandler,
	Interval,
	IntervalService,
	IntervalTO,
	Timer,
	TimerService,
	TimerTO,
	UserService
} from './offline';
import { pluginListeners } from './plugin-system';
import { AkitaStorageHandler } from './storage/akita-storage.handler';
import { RemoteTrackingSleep } from './strategies';
import { TranslateService } from './translation';

// Lazily initialized — construction is deferred until after app.ready to avoid
// native-module loads (better-sqlite3, uiohook-napi) and Electron API calls
// (app.getPath, app.getName) that are unsafe or cause hangs before app.ready.
let _timerHandler: TimerHandler | null = null;
let _offlineMode: IOfflineMode | null = null;
let _userService: UserService | null = null;
let _intervalService: IntervalService | null = null;
let _timerService: TimerService | null = null;
let _windowManager: WindowManager | null = null;
let _appWindowManager: AppWindowManager | null = null;

function getTimerHandler(): TimerHandler {
	if (!_timerHandler) _timerHandler = new TimerHandler();
	return _timerHandler;
}
function getOfflineMode(): IOfflineMode {
	if (!_offlineMode) _offlineMode = DesktopOfflineModeHandler.instance;
	return _offlineMode;
}
function getUserService(): UserService {
	if (!_userService) _userService = new UserService();
	return _userService;
}
function getIntervalService(): IntervalService {
	if (!_intervalService) _intervalService = new IntervalService();
	return _intervalService;
}
function getTimerService(): TimerService {
	if (!_timerService) _timerService = new TimerService();
	return _timerService;
}
function getWindowManager(): WindowManager {
	if (!_windowManager) _windowManager = WindowManager.getInstance();
	return _windowManager;
}
function getAppWindowManager(): AppWindowManager {
	if (!_appWindowManager) _appWindowManager = AppWindowManager.getInstance();
	return _appWindowManager;
}

export function setupAkitaStorageHandler() {
	return new AkitaStorageHandler(new AkitaStorageEngine());
}

export function ipcMainHandler(store, startServer, knex, config, timeTrackerWindow) {
	log.info('IPC Main Handler');

	ipcMain.removeAllListeners('return_time_sheet');
	ipcMain.removeAllListeners('return_toggle_api');
	ipcMain.removeAllListeners('set_project_task');
	removeAllHandlers();

	ipcMain.handle('START_SERVER', async (event, arg: DesktopSetupConfig) => {
		log.info('Handle Start Server');
		try {
			const baseUrl = arg.serverUrl
				? arg.serverUrl
				: arg.port
					? `http://localhost:${arg.port}`
					: `http://localhost:${config.API_DEFAULT_PORT}`;

			global.variableGlobal = {
				API_BASE_URL: baseUrl,
				IS_INTEGRATED_DESKTOP: arg.isLocalServer
			};

			return await startServer(arg);
		} catch (error) {
			log.error(error);
			return null;
		}
	});

	ipcMain.on('return_time_sheet', async (event, arg) => {
		try {
			log.info('Return Time Sheet');

			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
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
			log.error('Error on return time sheet', error);
			throw new UIError('400', error, 'IPCQSHEET');
		}
	});

	ipcMain.on('return_toggle_api', async (event, arg) => {
		try {
			log.info('Return Toggle API');

			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
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
			log.info('Error on return toggle api', error);
			throw new UIError('400', error, 'IPCQSLOT');
		}
	});

	ipcMain.on('failed_synced_timeslot', async (event, arg) => {
		try {
			log.info('Failed Synced TimeSlot');

			const interval = new Interval(arg.params);
			interval.screenshots = arg.params.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = false;
			interval.timerId = getTimerHandler().lastTimer?.id;

			await getIntervalService().create(interval.toObject());

			await countIntervalQueue(timeTrackerWindow, false);

			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
			log.info('Error on failed synced TimeSlot', error);
			throw new UIError('400', error, 'IPCSAVESLOT');
		}
	});

	ipcMain.on('set_project_task', (event, arg) => {
		event.sender.send('set_project_task_reply', arg);
	});

	ipcMain.on('time_tracker_ready', async (event, arg) => {
		log.info('Time Tracker Ready');

		// Update preferred language
		timeTrackerWindow.webContents.send('preferred_language_change', TranslateService.preferredLanguage);

		// Check Authenticated user
		await checkAuthenticatedUser(timeTrackerWindow);

		try {
			const lastTime = await getTimerService().findLastOne();

			log.info('Last Capture Time (Desktop IPC):', lastTime);

			await getOfflineMode().connectivity();

			log.info('Network state', getOfflineMode().enabled ? 'Offline' : 'Online');

			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null,
				isOffline: getOfflineMode().enabled
			});
			await countIntervalQueue(timeTrackerWindow, false);
			await sequentialSyncQueue(timeTrackerWindow);

			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
			log.error('Error on time tracker ready', error);
			throw new UIError('500', error, 'IPCINIT');
		}
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
		log.info(`Update App Setting: ${moment().format()}`);
		LocalStore.updateApplicationSetting(arg.values);
	});

	ipcMain.on('update_project_on', (event, arg) => {
		log.info(`Update Project On: ${moment().format()}`);
		LocalStore.updateConfigProject(arg);
	});

	ipcMain.on('request_permission', async (event) => {
		log.info('Request Permission');
		try {
			if (process.platform === 'darwin') {
				log.info('Request Permission for Darwin');
				if (isScreenUnauthorized()) {
					log.info('Screen is Unauthorized');

					event.sender.send('stop_from_tray', {
						quitApp: false
					});

					// Trigger macOS to ask user for screen capture permission
					try {
						await desktopCapturer.getSources({
							types: ['screen']
						});
					} catch (err) {
						log.error('Error on request permission', err);
						timeTrackerWindow?.webContents?.send('show_toast_message', {
							message: TranslateService.instant('TIMER_TRACKER.TOASTR.SCREEN_ACCESS_REQUIRED_MSG'),
							type: 'warning'
						});
						// soft fail
					}
				}
			}
		} catch (error) {
			log.error('Error on request permission', error);
			throw new UIError('500', error, 'IPCPERM');
		}
	});

	ipcMain.on('reset_permissions', () => {
		log.info('Reset Permissions');
		if (process.platform === 'darwin') {
			log.info('Reset Permissions for Darwin');
			if (isScreenUnauthorized()) {
				log.info('Screen is Unauthorized');
			}
		}
	});

	ipcMain.on('auth_failed', (event, arg) => {
		event.sender.send('show_toast_message', {
			type: 'error',
			message: arg.message
		});
	});

	ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', async (event, opts) => {
		log.info('Desktop Capturer Get Sources');
		const isDarwin = process.platform === 'darwin';
		if (isDarwin && isScreenUnauthorized()) {
			return [];
		}

		return await desktopCapturer.getSources(opts);
	});

	ipcMain.handle('UPDATE_SYNCED_TIMER', async (event, arg) => {
		log.info('Update Synced Timer');
		try {
			if (!arg.id) {
				const lastCapture = await getTimerService().findLastOne();

				if (lastCapture && lastCapture.id) {
					const { id } = lastCapture;
					arg = {
						...arg,
						id
					};
				}
			}

			if (arg.id) {
				if (!getOfflineMode().enabled) {
					console.log('Update Synced Timer Online');
					await getTimerService().update(
						new Timer({
							id: arg.id,
							synced: true,
							...(arg.lastTimer && {
								timelogId: arg.lastTimer?.id,
								timesheetId: arg.lastTimer?.timesheetId
							}),
							...(arg.lastTimer?.startedAt && {
								startedAt: new Date(arg.lastTimer?.startedAt)
							}),
							...(!arg.lastTimer && {
								synced: false,
								isStartedOffline: arg.isStartedOffline,
								isStoppedOffline: arg.isStoppedOffline
							}),
							...(arg.timeSlotId && {
								timeslotId: arg.timeSlotId
							})
						})
					);
				} else {
					console.log('Update Synced Timer Offline');
					await getTimerService().update(
						new Timer({
							id: arg.id,
							...(arg.startedAt && {
								startedAt: new Date(arg.startedAt)
							})
						})
					);
				}
			} else {
				console.log('No arg.id found');
			}

			console.log('Count Interval Queue');
			await countIntervalQueue(timeTrackerWindow, true);

			if (!isQueueThreadTimerLocked) {
				console.log('sequentialSyncQueue');
				await sequentialSyncQueue(timeTrackerWindow);
			}
		} catch (error) {
			log.error('Error on update synced timer', error);
			throw new UIError('400', error, 'IPCUPDATESYNCTMR');
		}
	});

	ipcMain.handle('COLLECT_ACTIVITIES', async (event, { quitApp }) => {
		try {
			log.info('Collect Activities');
			return await getTimerHandler().collectAllActivities(knex, quitApp);
		} catch (error) {
			log.error('Error collecting activities', error);
			throw new UIError('500', error, 'HANDLE ACTIVITIES');
		}
	});

	ipcMain.handle('UPDATE_SYNCED', async (event, arg: IntervalTO) => {
		try {
			log.info('Update Synced');
			const interval = new Interval(arg);
			interval.screenshots = [];
			await getIntervalService().synced(interval);
			await countIntervalQueue(timeTrackerWindow, true);
		} catch (error) {
			log.error('Error on update synced', error);
			throw new UIError('400', error, 'IPCUPDATESYNCINTERVAL');
		}
	});

	ipcMain.handle('FINISH_SYNCED_TIMER', async (event, arg) => {
		try {
			log.info('Finish Synced Timer');
			const total = await getIntervalService().countNoSynced();
			await countIntervalQueue(timeTrackerWindow, false);
			if (total === 0) {
				isQueueThreadTimerLocked = false;
				log.info('...FINISH SYNC');
			}
		} catch (error) {
			log.error('Error on finish synced timer', error);
		}
	});

	ipcMain.handle('SAVED_THEME', () => {
		return LocalStore.getStore('appSetting').theme;
	});

	ipcMain.handle('GET_LAST_CAPTURE', async () => {
		const lastCapture = await getTimerService().findLastCapture();
		return {
			timeSlotId: lastCapture?.timeslotId
		};
	});

	pluginListeners();
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
	soundPath,
	alwaysOn
) {
	let powerManager: IPowerManager | null = null;
	let powerManagerPreventSleep: PowerManagerPreventDisplaySleep | null = null;
	let powerManagerDetectInactivity: PowerManagerDetectInactivity | null = null;
	let osInactivityHandler: DesktopOsInactivityHandler | null = null;

	function cleanupPowerManagers() {
		if (osInactivityHandler) {
			osInactivityHandler.dispose();
			osInactivityHandler = null;
		}
		if (powerManagerDetectInactivity) {
			powerManagerDetectInactivity.dispose();
			powerManagerDetectInactivity = null;
		}
		if (powerManagerPreventSleep) {
			powerManagerPreventSleep.stop();
			powerManagerPreventSleep = null;
		}
		if (powerManager) {
			powerManager.dispose();
			powerManager = null;
		}
	}

	app.whenReady().then(async () => {
		if (!notificationWindow) {
			try {
				notificationWindow = new ScreenCaptureNotification(
					!process.env.IS_DESKTOP_TIMER ? windowPath.screenshotWindow : windowPath.timeTrackerUi
				);

				log.info('App Name:', app.getName());

				await notificationWindow.loadURL();
			} catch (error) {
				log.error('Error on create notification window', error);
				throw new UIError('500', error, 'IPCNOTIF');
			}
		}
	});

	ipcMain.on('create-synced-interval', async (_event, arg) => {
		log.info('Create Synced Interval');
		try {
			const interval = new Interval(arg);
			interval.screenshots = arg.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = true;
			interval.timerId = getTimerHandler().lastTimer?.id;
			await getIntervalService().create(interval.toObject());
			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
			log.error('Error on create synced interval', error);
			throw new UIError('400', error, 'IPCSAVEINTER');
		}
	});

	getOfflineMode().on('offline', async () => {
		log.info('Offline mode triggered...');
		const windows = [timeTrackerWindow];
		if (getAppWindowManager().alwaysOnWindow?.browserWindow) {
			windows.unshift(getAppWindowManager().alwaysOnWindow.browserWindow);
		}
		for (const window of windows) {
			getWindowManager().webContents(window)?.send?.('offline-handler', true);
		}
	});

	getOfflineMode().on('connection-restored', async () => {
		log.info('Api connected...');
		try {
			const windows = [timeTrackerWindow];
			if (getAppWindowManager().alwaysOnWindow?.browserWindow) {
				windows.unshift(getAppWindowManager().alwaysOnWindow.browserWindow);
			}
			for (const window of windows) {
				getWindowManager().webContents(window)?.send?.('offline-handler', false);
			}
			await sequentialSyncQueue(timeTrackerWindow);
		} catch (error) {
			log.error('Error on connection restored', error);
			throw new UIError('500', error, 'IPCRESTORE');
		}
	});

	getOfflineMode().trigger();

	ipcMain.handle('START_TIMER', async (event, arg) => {
		log.info(`Start Timer: ${moment().format()}`);

		// Check Authenticated user
		const isAuth = await checkAuthenticatedUser(timeTrackerWindow);

		log.info(`Authenticated User: ${isAuth}`);

		try {
			cleanupPowerManagers();
			powerManager = new DesktopPowerManager(timeTrackerWindow);
			powerManagerPreventSleep = new PowerManagerPreventDisplaySleep(powerManager);
			powerManagerDetectInactivity = new PowerManagerDetectInactivity(powerManager);
			osInactivityHandler = new DesktopOsInactivityHandler(powerManagerDetectInactivity);

			const setting = LocalStore.getStore('appSetting');

			log.info(`Timer Start: ${moment().format()}`);

			store.set({
				project: {
					projectId: arg?.projectId,
					taskId: arg?.taskId,
					note: arg?.note,
					aw: arg?.aw,
					organizationContactId: arg?.organizationContactId,
					organizationTeamId: arg?.organizationTeamId
				}
			});

			// Check API connection before starting
			await getOfflineMode().connectivity();

			log.info(`API Connection: ${moment().format()}`);

			// Start Timer
			const timerResponse = await getTimerHandler().startTimer(setupWindow, knex, timeTrackerWindow, arg?.timeLog);
			if (getAppWindowManager()?.settingWindow) {
				getAppWindowManager().settingWindow.webContents?.send?.('setting_page_ipc', {
					type: 'app_setting_update',
					data: {
						setting: LocalStore.getStore('appSetting')
					}
				});
			}

			if (setting && setting.preventDisplaySleep) {
				log.info('Prevent Display Sleep');
				powerManagerPreventSleep.start();
			}

			if (arg?.isRemoteTimer) {
				log.info(`SleepInactivityTracking: ${moment().format()}`);
				powerManager.trackingSleep = new TrackingSleepInactivity(new RemoteTrackingSleep(timeTrackerWindow));
			} else {
				log.info(`StartInactivityDetection: ${moment().format()}`);
				powerManagerDetectInactivity.startInactivityDetection();
			}

			return timerResponse;
		} catch (error) {
			log.error('Error on start timer', error);
			timeTrackerWindow.webContents.send('emergency_stop');
			cleanupPowerManagers();
			throw new UIError('400', error, 'IPCSTARTMR');
		}
	});

	ipcMain.handle('DELETE_TIME_SLOT', async (event, intervalId: number | string) => {
		try {
			log.info(`Delete Time Slot: ${moment().format()}`);

			const count = await getIntervalService().countNoSynced();

			const notify = new NotificationDesktop();

			const notification = {
				message: TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.SCREENSHOT_REMOVED'),
				title: process.env.DESCRIPTION
			};

			if (typeof intervalId === 'number' && intervalId && count > 0 && getOfflineMode().enabled) {
				await getIntervalService().remove(intervalId);
				await countIntervalQueue(timeTrackerWindow, false);
				await latestScreenshots(timeTrackerWindow);
				notify.customNotification(notification.message, notification.title);
			}

			if (!getOfflineMode().enabled && typeof intervalId === 'string') {
				await getIntervalService().removeByRemoteId(intervalId);
				const lastTimer = await getTimerService().findLastCapture();
				const lastInterval = await getIntervalService().findLastInterval();

				if (lastTimer) {
					lastTimer.timeslotId = lastInterval.remoteId;
					await getTimerService().update(new Timer(lastTimer));
				}

				notify.customNotification(notification.message, notification.title);

				return lastInterval.remoteId;
			}
		} catch (error) {
			log.error('Error on delete time slot', error);
			throw new UIError('400', error, 'IPCRMSLOT');
		}
	});

	ActivityWatchEventManager.onPushWindowActivity(async (_, result: IActivityWatchEventResult) => {
		const collections: IDesktopEvent[] = ActivityWatchEventAdapter.collections(result);

		if (!collections.length) return;

		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: ActivityWatchEventTableList.WINDOW,
					data: collections
				},
				knex
			);
		} catch (error) {
			log.error('Error on push window activity', error);
			throw new UIError('500', error, 'IPCQWIN');
		}
	});

	ActivityWatchEventManager.onPushAfkActivity(async (_, result: IActivityWatchEventResult) => {
		const collections: IDesktopEvent[] = ActivityWatchEventAdapter.collections(result);

		if (!collections.length) return;

		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: ActivityWatchEventTableList.AFK,
					data: collections
				},
				knex
			);
		} catch (error) {
			log.error('Error on push afk activity', error);
			throw new UIError('500', error, 'IPCQWIN');
		}
	});

	ActivityWatchEventManager.onPushFirefoxActivity(async (_, result: IActivityWatchEventResult) => {
		const collections: IDesktopEvent[] = ActivityWatchEventAdapter.collections(result);

		if (!collections.length) return;

		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: ActivityWatchEventTableList.FIREFOX,
					data: collections
				},
				knex
			);
		} catch (error) {
			log.error('Error on push firefox activity', error);
			throw new UIError('500', error, 'IPCQWIN');
		}
	});

	ActivityWatchEventManager.onPushChromeActivity(async (_, result: IActivityWatchEventResult) => {
		const collections: IDesktopEvent[] = ActivityWatchEventAdapter.collections(result);

		if (!collections.length) return;

		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: ActivityWatchEventTableList.CHROME,
					data: collections
				},
				knex
			);
		} catch (error) {
			log.error('Error on push chrome activity', error);
			throw new UIError('500', error, 'IPCQWIN');
		}
	});

	ActivityWatchEventManager.onRemoveAfkLocalData(async (_, value: any) => {
		try {
			const afkService = new ActivityWatchAfkService();
			await afkService.clear();
		} catch (error) {
			log.error('Error on remove afk local data', error);
			throw new UIError('500', error, 'IPCRMAFK');
		}
	});

	ActivityWatchEventManager.onRemoveLocalData(async (_, value: any) => {
		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: 'remove-window-events'
				},
				knex
			);
		} catch (error) {
			log.error('Error on remove local data', error);
			throw new UIError('500', error, 'IPCRMAW');
		}
	});

	ActivityWatchEventManager.onStatusChange((_, awIsConnected: boolean) => {
		LocalStore.updateApplicationSetting({
			awIsConnected
		});
	});

	ActivityWatchEventManager.onSet((_, aw) => {
		const projectInfo = LocalStore.getStore('project');
		store.set({
			project: {
				...projectInfo,
				aw
			}
		});
	});

	ActivityWatchEventManager.onPushEdgeActivity(async (_, result: IActivityWatchEventResult) => {
		const collections: IDesktopEvent[] = ActivityWatchEventAdapter.collections(result);
		if (!collections.length) return;
		try {
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: ActivityWatchEventTableList.EDGE,
					data: collections
				},
				knex
			);
		} catch (error) {
			log.error('Error on push edge activity', error);
			throw new UIError('500', error, 'IPCQWIN');
		}
	});

	ipcMain.on('remove_wakatime_local_data', async (event, arg) => {
		try {
			if (arg.idsWakatime && arg.idsWakatime.length > 0) {
				await getTimerHandler().processWithQueue(
					`gauzy-queue`,
					{
						type: 'remove-wakatime-events',
						data: arg.idsWakatime
					},
					knex
				);
			}
		} catch (error) {
			log.error('Error on remove wakatime local data', error);
			throw new UIError('500', error, 'IPCRMWK');
		}
	});

	ipcMain.handle('STOP_TIMER', async (event, arg) => {
		try {
			log.info(`Timer Stop: ${moment().format()}`);

			// Check api connection before to stop
			if (!arg.isEmergency) {
				// We check connectivity before stop timer, but we don't block the process for now...
				// Instead, we should notify the user that timer might not stop correctly and retry stop the timer after connection to API is restored
				setTimeout(async () => {
					log.info('Check API Connection During Stop Timer...');

					await getOfflineMode().connectivity();

					if (getOfflineMode().enabled) {
						console.log('Offline Mode: Mark as stopped offline');
						await markLastTimerAsStoppedOffline();
						// We may want to show some notification to user that timer might not stop correctly, but not with Error, more like notification popup
						// throw new Error('Cannot establish connection to API during Timer Stop');
					} else {
						console.log('API working well During Stop Timer');
					}
				}, 10);
			}

			console.log('Continue stopping timer ...');

			// Stop Timer
			const timerResponse = await getTimerHandler().stopTimer(setupWindow, timeTrackerWindow, knex, arg.quitApp);

			console.log('Timer Stopped ...');

			getAppWindowManager().settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'app_setting_update',
				data: {
					setting: LocalStore.getStore('appSetting')
				}
			});

			cleanupPowerManagers();

			return timerResponse;
		} catch (error) {
			log.info('Error on stop timer', error);
			timeTrackerWindow.webContents.send('emergency_stop');
			cleanupPowerManagers();
			throw new UIError('500', error, 'IPCSTOPTMR');
		}
	});

	ipcMain.on('return_time_slot', async (event, arg) => {
		try {
			const { timeSlotId, timerId } = arg;
			log.info(`Return To Timeslot Last Timeslot ID: ${timeSlotId} and Timer ID: ${timerId}`);
			LocalStore.updateAdditionalSetting({ timeSlotId });
			await getTimerHandler().processWithQueue(
				`gauzy-queue`,
				{
					type: 'update-timer-time-slot',
					data: {
						id: timerId,
						timeSlotId
					}
				},
				knex
			);

			timeTrackerWindow.webContents.send('refresh_time_log', LocalStore.beforeRequestParams());

			// after update time slot do upload screenshot
			// check config
			const appSetting = LocalStore.getStore('appSetting');

			log.info(`App Setting: ${moment().format()}`, appSetting);

			log.info(`Config: ${moment().format()}`, config);

			if (!arg.quitApp) {
				log.info('TimeLogs:', arg.timeLogs);

				// create new timer entry after create timeslot
				let timeLogs = arg.timeLogs;
				timeLogs = _.sortBy(timeLogs, 'recordedAt').reverse();

				const [timeLog] = timeLogs;
				await getTimerHandler().createTimer(timeLog);
			}
		} catch (error) {
			log.error('Error on return time slot', error);
			throw new UIError('500', error, 'IPCRTNSLOT');
		}
	});

	ipcMain.on('show_screenshot_notif_window', async (event, arg) => {
		log.info(`Show Screenshot Notification Window: ${moment().format()}`);
		const appSetting = LocalStore.getStore('appSetting');
		const notify = new NotificationDesktop();
		if (appSetting) {
			if (appSetting.simpleScreenshotNotification) {
				notify.customNotification(
					TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.SCREENSHOT_TAKEN'),
					process.env.DESCRIPTION
				);
			} else if (appSetting.screenshotNotification) {
				try {
					await notifyScreenshot(notificationWindow, arg, windowPath, soundPath, timeTrackerWindow);
				} catch (error) {
					throw new UIError('500', error, 'IPCNTFSHOT');
				}
			}
		}
	});

	ipcMain.on('save_screen_shoot', async (event, arg) => {
		log.info(`Save Screen Shoot: ${moment().format()}`);
		try {
			await takeshot(timeTrackerWindow, arg, notificationWindow, false, windowPath, soundPath);
		} catch (error) {
			log.error('Error on save screen shoot', error);
			throw new UIError('400', error, 'IPCTKSHOT');
		}
	});

	ipcMain.on('show_image', async (event, arg) => {
		if (!getAppWindowManager().imageView) {
			await getAppWindowManager().initImageViewWindow(windowPath.timeTrackerUi);
			ipcMain.once('image_view_ready', () => {
				getAppWindowManager().imageView?.webContents?.send?.('show_image', arg);
				getAppWindowManager().imageView?.webContents?.send?.('refresh_menu');
			});
			await getAppWindowManager().loadImageView(windowPath.timeTrackerUi);
		} else {
			getAppWindowManager().imageView?.webContents?.send?.('show_image', arg);
			getAppWindowManager().imageView?.webContents?.send?.('refresh_menu');
		}

		getAppWindowManager().imageView?.show();
	});

	ipcMain.on('close_image_view', async () => {
		await getAppWindowManager().initImageViewWindow(windowPath.timeTrackerUi);
		getAppWindowManager().imageView?.close?.();
	});

	ipcMain.on('save_temp_screenshot', async (event, arg) => {
		try {
			log.info(`Save Temp Screenshot: ${moment().format()}`);
			await takeshot(timeTrackerWindow, arg, notificationWindow, true, windowPath, soundPath);
		} catch (error) {
			log.error('Error on save temp screenshot', error);
			throw new UIError('400', error, 'IPCSAVESHOT');
		}
	});

	ipcMain.on('open_setting_window', async (event, arg) => {
		log.info(`Open Setting Window: ${moment().format()}`);
		if (!getAppWindowManager().settingWindow) {
			await getAppWindowManager().initSettingWindow(windowPath.timeTrackerUi, windowPath.preloadPath, false);
			ipcMain.once('setting_window_ready', () => {
				getAppWindowManager().settingShow('goto_top_menu');
			});
			await getAppWindowManager().loadSetting(windowPath.timeTrackerUi);
		} else {
			getAppWindowManager().settingShow('goto_top_menu');
		}
		getAppWindowManager().settingWindow?.show?.();
	});

	ipcMain.on('switch_aw_option', (event, arg) => {
		const settings = LocalStore.getStore('appSetting');
		timeTrackerWindow.webContents.send('update_setting_value', settings);
	});

	ipcMain.on('logout_desktop', async (event, arg) => {
		try {
			log.info('Logout Desktop');
			timeTrackerWindow.webContents.send('logout', arg);
		} catch (error) {
			log.error('Error Logout Desktop', error);
		}
	});

	ipcMain.on('navigate_to_login', async () => {
		try {
			log.info('Navigate To Login');

			LocalStore.updateAuthSetting({ isLogout: true });

			if (getAppWindowManager()?.settingWindow) {
				getAppWindowManager().settingWindow.webContents?.send?.('setting_page_ipc', {
					type: 'logout_success'
				});
			}
		} catch (error) {
			log.error('IPCQNVGLOGIN', error);
		}
	});

	ipcMain.on('expand', (event, arg) => {
		try {
			log.info(`Expand: ${moment().format()}`);
			resizeWindow(timeTrackerWindow, arg);
			event.sender.send('expand', arg);
		} catch (error) {
			log.error('error on change window width', error);
		}
	});

	ipcMain.handle(
		'UPDATE_SYNC_STATE',
		async (
			_,
			arg: {
				actionType: TimerActionTypeEnum;
				data: {
					state: TimerSyncStateEnum;
					duration: number;
					timerId: number;
				};
			}
		) => {
			try {
				await getTimerHandler().updateTimerSyncState(arg.actionType, arg.data);
			} catch (error) {
				console.error(`ERROR_UPDATE_SYNC_STATE: ${error}`);
			}
			return;
		}
	);

	function resizeWindow(window: BrowserWindow, isExpanded: boolean): void {
		const display = screen.getPrimaryDisplay();
		const { height, width } = display.workAreaSize;

		log.info('workAreaSize', { height, width });

		const maxHeight = height <= 768 ? height - 20 : 768;
		const maxWidth = height < 768 ? 360 - 50 : 360;
		const widthLarge = height < 768 ? 1280 - 50 : 1280;

		switch (process.platform) {
			case 'linux':
				{
					const wx = isExpanded ? 1280 : 360;
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
					let calculatedX = (width - (isExpanded ? widthLarge : maxWidth)) * 0.5;
					let calculatedY = (height - maxHeight) * 0.5;

					// Ensure x and y are not negative
					calculatedX = Math.max(0, calculatedX);
					calculatedY = Math.max(0, calculatedY);

					// Ensure window does not exceed screen bounds
					calculatedX = Math.min(calculatedX, width - (isExpanded ? widthLarge : maxWidth));
					calculatedY = Math.min(calculatedY, height - maxHeight);

					const bounds = {
						width: isExpanded ? widthLarge : maxWidth,
						height: maxHeight,
						x: Math.round(calculatedX),
						y: Math.round(calculatedY)
					};

					log.info('Bounds', JSON.stringify(bounds));

					window.setBounds(bounds, true);
				}

				break;
		}
	}

	ipcMain.on('timer_stopped', (event, arg) => {
		log.info(`Timer Stopped: ${moment().format()}`);
		timeTrackerWindow.webContents.send('timer_already_stop');
	});

	ipcMain.on('refresh-timer', async (event) => {
		log.info(`Refresh Timer: ${moment().format()}`);
		try {
			const lastTime = await getTimerService().findLastCapture();

			log.info('Last Capture Time Start Tracking Time (Desktop Try):', lastTime);

			if (!isQueueThreadTimerLocked) {
				await sequentialSyncQueue(timeTrackerWindow);
			}

			await latestScreenshots(timeTrackerWindow);

			await countIntervalQueue(timeTrackerWindow, false);

			timeTrackerWindow.webContents.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null
			});
		} catch (error) {
			log.error('Error on refresh timer', error);
			timeTrackerWindow.webContents.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: null
			});
			throw new UIError('500', error, 'IPCREFRESH');
		}
	});

	ipcMain.on('update_timer_auth_config', (event, arg) => {
		LocalStore.updateAuthSetting({ ...arg });
	});

	ipcMain.on('notify', (event, notification) => {
		const notify = new NotificationDesktop();
		notify.customNotification(notification.message, notification.text);
	});

	ipcMain.on('update_session', (event, timer: TimerTO) => {
		getTimerHandler().timeStart = moment(timer.startedAt);
	});

	ipcMain.on('remove_current_user', async (event, arg) => {
		try {
			log.info(`Remove Current User: ${moment().format()}`);
			await getUserService().remove();
		} catch (error) {
			log.error('Error on remove current user', error);
			throw new UIError('500', error, 'IPCRMUSER');
		}
	});

	ipcMain.on('server-down', async (event, arg) => {
		// Check api connection
		await getOfflineMode().connectivity();
	});

	ipcMain.on('check-interrupted-sequences', async (event, arg) => {
		try {
			log.info(`Check Interrupted Sequences: ${moment().format()}`);
			await sequentialSyncInterruptionsQueue(timeTrackerWindow);
		} catch (error) {
			log.error('Error on check interrupted sequences', error);
			throw new UIError('500', error, 'IPCCIS');
		}
	});

	ipcMain.on('check-waiting-sequences', async (event, arg) => {
		try {
			log.info(`Check Waiting Sequences: ${moment().format()}`);
			await sequentialSyncQueue(timeTrackerWindow);
		} catch (error) {
			log.error('Error on check waiting sequences', error);
			throw new UIError('500', error, 'IPCWS');
		}
	});

	ipcMain.handle('LOGOUT_STOP', async (event, arg) => {
		try {
			log.info(`Logout Stop: ${moment().format()}`);
			return await handleLogoutDialog(timeTrackerWindow);
		} catch (error) {
			log.error('Error on logout stop', error);
			throw new UIError('500', error, 'IPCWS');
		}
	});

	ipcMain.on('preferred_language_change', (event, arg) => {
		TranslateService.preferredLanguage = arg;
	});

	TranslateService.onLanguageChange((language: string) => {
		try {
			const windows = getWindowManager().getActives();
			for (const window of windows) {
				const webContents = getWindowManager().webContents(window);
				if (webContents) {
					webContents.send('preferred_language_change', language);
				}
			}
		} catch (error) {
			console.error('An error occurred:', error.message);
		}
	});

	ipcMain.on('show_ao', async (event, arg) => {
		const setting = LocalStore.getStore('appSetting');
		const auth = LocalStore.getStore('auth');
		if (setting?.alwaysOn && auth?.employeeId) {
			await getAppWindowManager().initAlwaysOnWindow(windowPath.timeTrackerUi);
			getAppWindowManager().alwaysOnWindow.show?.();
		}
	});

	ipcMain.on('hide_ao', (event, arg) => {
		if (getAppWindowManager().alwaysOnWindow) {
			getAppWindowManager().alwaysOnWindow.browserWindow?.close?.();
		}
	});

	ipcMain.on('change_state_from_ao', async (event, arg) => {
		const windows = [timeTrackerWindow];
		if (getAppWindowManager().alwaysOnWindow?.browserWindow) {
			windows.unshift(getAppWindowManager().alwaysOnWindow.browserWindow);
		}
		for (const window of windows) {
			getWindowManager().webContents(window)?.send?.('change_state_from_ao', arg);
		}
	});

	ipcMain.on('ao_time_update', (event, arg) => {
		getAppWindowManager().alwaysOnWindow?.browserWindow?.webContents?.send?.('ao_time_update', arg);
	});

	ipcMain.handle('MARK_AS_STOPPED_OFFLINE', async () => {
		await markLastTimerAsStoppedOffline();
	});

	ipcMain.handle('CURRENT_TIMER', () => {
		return getTimerService().findLastOne();
	});

	ipcMain.handle('LAST_SYNCED_INTERVAL', () => {
		return getIntervalService().findLastInterval();
	});

	ipcMain.handle('UPDATE_SELECTOR', async (_, args) => {
		try {
			// Destructure args for cleaner access
			const { taskId, timerId, projectId, description, organizationTeamId, organizationContactId, startedAt } =
				args;

			const config = {
				taskId,
				projectId,
				note: description,
				organizationTeamId,
				organizationContactId
			};

			// Update the local store configuration
			LocalStore.updateConfigProject(config);

			// Update last timeslot moment
			getTimerHandler().timeSlotStart = moment(startedAt);

			// Update timer with new config
			await getTimerService().update(new Timer({ id: timerId, description, startedAt, ...config }));

			console.log('update selector', '✔️ Done');
		} catch (error) {
			console.error('Failed to update selector:', error);
		}
	});
}

export function removeMainListener() {
	const mainListeners = [
		'update_timer_auth_config',
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
	removeTimerHandlers();
	const timerListeners = [
		'remove_wakatime_local_data',
		'return_time_slot',
		'show_screenshot_notif_window',
		'save_screen_shoot',
		'show_image',
		'close_image_view',
		'save_temp_screenshot',
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

export function removeAllHandlers() {
	const channels = [
		'UPDATE_SYNCED_TIMER',
		'UPDATE_SYNCED',
		'DESKTOP_CAPTURER_GET_SOURCES',
		'FINISH_SYNCED_TIMER',
		'COLLECT_ACTIVITIES',
		'START_SERVER',
		'GET_LAST_CAPTURE'
	];
	channels.forEach((channel: string) => {
		ipcMain.removeHandler(channel);
	});
}

export function removeTimerHandlers() {
	const channels = [
		'START_TIMER',
		'STOP_TIMER',
		'LOGOUT_STOP',
		'DELETE_TIME_SLOT',
		'MARK_AS_STOPPED_OFFLINE',
		'CURRENT_TIMER',
		'LAST_SYNCED_INTERVAL',
		'UPDATE_SELECTOR',
		'UPDATE_SYNC_STATE'
	];
	channels.forEach((channel: string) => {
		ipcMain.removeHandler(channel);
	});
}

let isQueueThreadTimerLocked = false;

async function sequentialSyncQueue(window: BrowserWindow) {
	try {
		if (!window) return;

		// Check Authenticated user
		const isAuthenticated = await checkAuthenticatedUser(window);

		if (!isAuthenticated) {
			return;
		}

		await getOfflineMode().connectivity();

		if (getOfflineMode().enabled) return;

		isQueueThreadTimerLocked = true;

		const sequences = await getTimerService().findToSynced();

		if (sequences.length > 0) {
			await countIntervalQueue(window, true);
			window.webContents.send('backup-timers-no-synced', sequences);
		} else {
			isQueueThreadTimerLocked = false;
		}
	} catch (error) {
		log.error('Error on sequential sync queue', error);
		throw new UIError('500', error, 'IPCWS');
	}
}

let size = Infinity;

async function countIntervalQueue(window: BrowserWindow, inProgress: boolean) {
	log.info(`Count Interval Queue: ${moment().format()}`);

	if (!window) return;

	try {
		size = await getIntervalService().countNoSynced();
		if (size < 1) isQueueThreadTimerLocked = false;
		log.info('Sending Count Synced Event...', { size, inProgress });

		window.webContents.send('count-synced', { size, inProgress });
	} catch (error) {
		log.error('Error on count interval queue', error);
		throw new UIError('500', error, 'IPCQCI');
	}
}

async function latestScreenshots(window: BrowserWindow): Promise<void> {
	log.info(`Latest Screenshots: ${moment().format()}`);
	if (!window) return;

	try {
		log.info('Sending Latest Screenshots Event...');

		window.webContents.send('latest_screenshots', await getIntervalService().screenshots());
	} catch (error) {
		log.error('Error on latest screenshots', error);
		throw new UIError('500', error, 'IPCLS');
	}
}

async function sequentialSyncInterruptionsQueue(window: BrowserWindow) {
	log.info(`Sequential Sync Interruptions Queue: ${moment().format()}`);

	if (!window) return;

	// Check Authenticated user
	const isAuthenticated = await checkAuthenticatedUser(window);
	log.info(`Authenticated User: ${isAuthenticated}`);

	if (!isAuthenticated) {
		return;
	}

	try {
		await getOfflineMode().connectivity();

		if (getOfflineMode().enabled) return;

		isQueueThreadTimerLocked = true;

		const sequences = await getTimerService().interruptions();

		if (sequences.length > 0) {
			await countIntervalQueue(window, true);
			window.webContents.send('interrupted-sequences', sequences);
		} else {
			isQueueThreadTimerLocked = false;
		}
	} catch (error) {
		log.error('Error on sequential sync interruptions queue', error);
		throw new UIError('500', error, 'IPCCIS');
	}
}

export async function handleLogoutDialog(window: BrowserWindow): Promise<boolean> {
	const dialog = new DialogStopTimerLogoutConfirmation(
		new DesktopDialog(process.env.DESCRIPTION, TranslateService.instant('TIMER_TRACKER.DIALOG.WANT_LOGOUT'), window)
	);
	const button = await dialog.show();
	return button.response === 0;
}

export async function checkAuthenticatedUser(timeTrackerWindow: BrowserWindow): Promise<boolean> {
	log.info(`Check Authenticated User: ${moment().format()}`);

	const auth = LocalStore.getStore('auth');

	const logout = async () => {
		await getUserService().remove();
		timeTrackerWindow.webContents.send('__logout__');
		LocalStore.updateAuthSetting({ isLogout: true });
	};

	const handleLogout = async (errorMessage: string) => {
		await logout();
		log.error(errorMessage);
	};

	try {
		if (!auth || !auth.userId) {
			await handleLogout('Authentication failed');
			return false;
		}

		const user = await getUserService().retrieve();
		log.info('Current User', user);

		// Ensure we have a valid user and matching remoteId
		if (!user || !user.remoteId || auth.userId !== user.remoteId) {
			await handleLogout('Authentication failed');
			return false;
		}

		// Ensure employee exists on the user record before accepting authentication
		if (user.employee) {
			LocalStore.updateAuthSetting({ isLogout: false });
			return true;
		}
	} catch (error) {
		log.error('Error on check authenticated user', error);
		await handleLogout('An error occurred during authentication check.');
	}

	return false;
}

export async function markLastTimerAsStoppedOffline(): Promise<void> {
	try {
		// Retrieve the last timer if not provided
		const lastTimer = await getTimerService().findLastOne();

		// Check if a timer was found or provided
		if (!lastTimer || !lastTimer.id) {
			throw new Error('No valid timer found.');
		}

		// Update the timer's state to "stopped offline"
		await getTimerService().update(new Timer({ ...lastTimer, isStoppedOffline: true }));
	} catch (error) {
		// Throw a more descriptive error message with context
		log.error(`Failed to mark the last timer as stopped offline: ${error.message}`);
	}
}
