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
import {
	ScreenCaptureNotification,
	loginPage,
} from '@gauzy/desktop-window';
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
import { DialogStopTimerLogoutConfirmation } from './decorators/concretes/dialog-stop-timer-logout-confirmation';
import { DesktopDialog } from './desktop-dialog';
import { TranslateService } from './translation';
import { IPowerManager } from './interfaces';
import { SleepInactivityTracking } from './contexts';
import { RemoteSleepTracking } from './strategies';
import { UIError } from './error-handler';

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
	ipcMain.removeAllListeners('remove_afk_local_Data');
	ipcMain.removeAllListeners('return_time_sheet');
	ipcMain.removeAllListeners('return_toggle_api');
	ipcMain.removeAllListeners('set_project_task');
	removeAllHandlers();
	ipcMain.handle('START_SERVER', async (event, arg) => {
		try {
			global.variableGlobal = {
				API_BASE_URL: arg.serverUrl
					? arg.serverUrl
					: arg.port
						? `http://localhost:${arg.port}`
						: `http://localhost:${config.API_DEFAULT_PORT}`,
				IS_INTEGRATED_DESKTOP: arg.isLocalServer,
			};
			return await startServer(arg);
		} catch (error) {
			console.error(error);
			return null;
		}
	});

	ipcMain.on('remove_afk_local_Data', async (event, arg) => {
		try {
			await TimerData.deleteAfk(knex, {
				idAfk: arg.idAfk,
			});
		} catch (error) {
			throw new UIError('500', error, 'IPCRMAFK');
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
						timeLogId: arg.timeLogId,
					},
				},
				knex
			);
		} catch (error) {
			throw new UIError('400', error, 'IPCQSHEET');
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
						timeLogId: arg.result.id,
					},
				},
				knex
			);
		} catch (error) {
			throw new UIError('400', error, 'IPCQSLOT');
		}
	});

	ipcMain.on('failed_synced_timeslot', async (event, arg) => {
		try {
			const interval = new Interval(arg.params);
			interval.screenshots = arg.params.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = false;
			interval.timerId = timerHandler.lastTimer?.id;
			await intervalService.create(interval.toObject());
			await countIntervalQueue(timeTrackerWindow, false);
			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
			throw new UIError('400', error, 'IPCSAVESLOT');
		}
	});

	ipcMain.on('set_project_task', (event, arg) => {
		event.sender.send('set_project_task_reply', arg);
	});

	ipcMain.on('time_tracker_ready', async (event, arg) => {
		const auth = LocalStore.getStore('auth');
		const logout = async () => {
			try {
				await userService.remove();
				timeTrackerWindow.webContents.send('__logout__');
				LocalStore.updateAuthSetting({ isLogout: true });
			} catch (error) {
				throw new UIError('500', error, 'IPCRMUSER');
			}
		};
		if (auth && auth.userId) {
			try {
				const user = await userService.retrieve();
				console.log('Current User', user);
				if (user) {
					if (auth.userId !== user.remoteId) {
						await logout();
					}
				} else {
					const user = new User({ ...auth });
					user.remoteId = auth.userId;
					user.organizationId = auth.organizationId;
					if (user.employee) {
						await userService.save(user.toObject());
					}
					LocalStore.updateAuthSetting({ isLogout: false });
				}
			} catch (error) {
				await logout();
				throw new UIError('500', error, 'IPCINIT');
			}
		} else {
			await logout();
		}

		try {
			timeTrackerWindow.webContents.send(
				'preferred_language_change',
				TranslateService.preferredLanguage
			);

			const lastTime = await TimerData.getLastCaptureTimeSlot(
				knex,
				LocalStore.beforeRequestParams()
			);

			console.log('Last Capture Time (Desktop IPC):', lastTime);

			await offlineMode.connectivity();
			console.log(
				'Network state',
				offlineMode.enabled ? 'Offline' : 'Online'
			);
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null,
				isOffline: offlineMode.enabled,
			});
			await countIntervalQueue(timeTrackerWindow, false);
			await sequentialSyncQueue(timeTrackerWindow);

			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
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
						quitApp: true,
					});
					// Trigger macOS to ask user for screen capture permission
					try {
						await desktopCapturer.getSources({
							types: ['screen'],
						});
					} catch (_) {
						// soft fail
					}
				}
			}
		} catch (error) {
			throw new UIError('500', error, 'IPCPERM');
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

	ipcMain.handle(
		'DESKTOP_CAPTURER_GET_SOURCES',
		async (event, opts) => await desktopCapturer.getSources(opts)
	);

	ipcMain.handle('UPDATE_SYNCED_TIMER', async (event, arg) => {
		try {
			if (!arg.id) {
				const { id } = await timerService.findLastCapture();
				arg = {
					...arg,
					id,
				};
			}
			if (!offlineMode.enabled) {
				await timerService.update(
					new Timer({
						id: arg.id,
						timelogId: arg.lastTimer?.id,
						timesheetId: arg.lastTimer?.timesheetId,
						synced: true,
						...(arg.lastTimer?.startedAt && {
							startedAt: new Date(arg.lastTimer?.startedAt),
						}),
						...(!arg.lastTimer && {
							synced: false,
							isStartedOffline: arg.isStartedOffline,
							isStoppedOffline: arg.isStoppedOffline,
						}),
					})
				);
			}
			await countIntervalQueue(timeTrackerWindow, true);
			if (!isQueueThreadTimerLocked) {
				await sequentialSyncQueue(timeTrackerWindow);
			}
		} catch (error) {
			throw new UIError('400', error, 'IPCUPDATESYNCTMR');
		}
	});

	ipcMain.handle('TAKE_SCREEN_CAPTURE', async (event, { quitApp }) => {
		try {
			return await timerHandler.makeScreenshot(knex, quitApp);
		} catch (error) {
			throw new UIError('500', error, 'IPCTKSCAPTURE');
		}
	});

	ipcMain.handle('UPDATE_SYNCED', async (event, arg: IntervalTO) => {
		try {
			const interval = new Interval(arg);
			interval.screenshots = [];
			await intervalService.synced(interval);
			await countIntervalQueue(timeTrackerWindow, true);
		} catch (error) {
			throw new UIError('400', error, 'IPCUPDATESYNCINTERVAL');
		}
	});

	ipcMain.handle('FINISH_SYNCED_TIMER', async (event, arg) => {
		const total = await intervalService.countNoSynced();
		await countIntervalQueue(timeTrackerWindow, false);
		if (total === 0) {
			isQueueThreadTimerLocked = false;
			console.log('...FINISH SYNC');
		}
	});
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
	let powerManager: IPowerManager;
	let powerManagerPreventSleep: PowerManagerPreventDisplaySleep;
	let powerManagerDetectInactivity: PowerManagerDetectInactivity;
	app.whenReady().then(async () => {
		if (!notificationWindow) {
			try {
				notificationWindow = new ScreenCaptureNotification(
					!process.env.IS_DESKTOP_TIMER
						? windowPath.screenshotWindow
						: windowPath.timeTrackerUi
				);
				console.log('App Name:', app.getName());
				await notificationWindow.loadURL();
			} catch (error) {
				throw new UIError('500', error, 'IPCNOTIF');
			}
		}
	});

	ipcMain.on('create-synced-interval', async (_event, arg) => {
		try {
			const interval = new Interval(arg);
			interval.screenshots = arg.b64Imgs;
			interval.stoppedAt = new Date();
			interval.synced = true;
			interval.timerId = timerHandler.lastTimer?.id;
			await intervalService.create(interval.toObject());
			await latestScreenshots(timeTrackerWindow);
		} catch (error) {
			throw new UIError('400', error, 'IPCSAVEINTER');
		}
	});

	offlineMode.on('offline', async () => {
		console.log('Offline mode triggered...');
		const windows = [alwaysOn.browserWindow, timeTrackerWindow];
		for (const window of windows) {
			window.webContents.send('offline-handler', true);
		}
	});

	offlineMode.on('connection-restored', async () => {
		console.log('Api connected...');
		try {
			const windows = [alwaysOn.browserWindow, timeTrackerWindow];
			for (const window of windows) {
				window.webContents.send('offline-handler', false);
			}
			await sequentialSyncQueue(timeTrackerWindow);
		} catch (error) {
			throw new UIError('500', error, 'IPCRESTORE');
		}
	});

	offlineMode.trigger();

	ipcMain.handle('START_TIMER', async (event, arg) => {
		try {
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
					organizationTeamId: arg.organizationTeamId
				},
			});

			// Check API connection before starting
			await offlineMode.connectivity();

			// Start Timer
			const timerResponse = await timerHandler.startTimer(
				setupWindow,
				knex,
				timeTrackerWindow,
				arg.timeLog
			);
			settingWindow.webContents.send('app_setting_update', {
				setting: LocalStore.getStore('appSetting'),
			});

			if (setting && setting.preventDisplaySleep) {
				powerManagerPreventSleep.start();
			}

			if (arg.isRemoteTimer) {
				powerManager.sleepTracking = new SleepInactivityTracking(
					new RemoteSleepTracking(timeTrackerWindow)
				);
			} else {
				powerManagerDetectInactivity.startInactivityDetection();
			}
			return timerResponse;
		} catch (error) {
			timeTrackerWindow.webContents.send('emergency_stop');
			throw new UIError('400', error, 'IPCSTARTMR');
		}
	});

	ipcMain.on('delete_time_slot', async (event, intervalId: number) => {
		try {
			const count = await intervalService.countNoSynced();
			if (
				typeof intervalId === 'number' &&
				intervalId &&
				count > 0 &&
				offlineMode.enabled
			) {
				const notification = {
					message: TranslateService.instant(
						'TIMER_TRACKER.NATIVE_NOTIFICATION.SCREENSHOT_REMOVED'
					),
					title: process.env.DESCRIPTION,
				};
				const notify = new NotificationDesktop();
				await intervalService.remove(intervalId);
				await countIntervalQueue(timeTrackerWindow, false);
				await latestScreenshots(timeTrackerWindow);
				notify.customNotification(
					notification.message,
					notification.title
				);
			}
			if (!offlineMode.enabled) {
				const lastTimer = await timerService.findLastCapture();
				await timerService.remove(new Timer(lastTimer));
			}
		} catch (error) {
			throw new UIError('400', error, 'IPCRMSLOT');
		}
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
			try {
				await timerHandler.createQueue(
					'sqlite-queue',
					{
						data: collections,
						type: 'window-events',
					},
					knex
				);
			} catch (error) {
				throw new UIError('500', error, 'IPCQWIN');
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
						data: arg.idsAw,
					},
					knex
				);
			}
		} catch (error) {
			throw new UIError('500', error, 'IPCRMAW');
		}
	});

	ipcMain.on('remove_wakatime_local_data', async (event, arg) => {
		try {
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
		} catch (error) {
			throw new UIError('500', error, 'IPCRMWK');
		}
	});

	ipcMain.handle('STOP_TIMER', async (event, arg) => {
		try {
			log.info(`Timer Stop: ${moment().format()}`);
			// Check api connection before to stop
			if (!arg.isEmergency) {
				await offlineMode.connectivity();
			}
			// Stop Timer
			const timerResponse = await timerHandler.stopTimer(
				setupWindow,
				timeTrackerWindow,
				knex,
				arg.quitApp
			);
			settingWindow.webContents.send('app_setting_update', {
				setting: LocalStore.getStore('appSetting'),
			});
			if (powerManagerPreventSleep) {
				powerManagerPreventSleep.stop();
			}
			if (powerManagerDetectInactivity) {
				powerManagerDetectInactivity.stopInactivityDetection();
			}
			return timerResponse;
		} catch (error) {
			timeTrackerWindow.webContents.send('emergency_stop');
			throw new UIError('500', error, 'IPCSTOPTMR');
		}
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
			if (!arg.quitApp) {
				console.log('TimeLogs:', arg.timeLogs);

				// create new timer entry after create timeslot
				let timeLogs = arg.timeLogs;
				timeLogs = _.sortBy(timeLogs, 'recordedAt').reverse();

				const [timeLog] = timeLogs;
				await timerHandler.createTimer(knex, timeLog);
			}
		} catch (error) {
			throw new UIError('500', error, 'IPCRTNSLOT');
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

	ipcMain.on('show_screenshot_notif_window', async (event, arg) => {
		const appSetting = LocalStore.getStore('appSetting');
		const notify = new NotificationDesktop();
		if (appSetting) {
			if (appSetting.simpleScreenshotNotification) {
				notify.customNotification(
					TranslateService.instant(
						'TIMER_TRACKER.NATIVE_NOTIFICATION.SCREENSHOT_TAKEN'
					),
					process.env.DESCRIPTION
				);
			} else if (appSetting.screenshotNotification) {
				try {
					await notifyScreenshot(
						notificationWindow,
						arg,
						windowPath,
						soundPath,
						timeTrackerWindow
					);
				} catch (error) {
					throw new UIError('500', error, 'IPCNTFSHOT');
				}
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
			throw new UIError('400', error, 'IPCTKSHOT');
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
						message: arg.message,
					},
				},
				knex
			);
		} catch (error) {
			throw new UIError('400', error, 'IPCSAVESLOT');
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
			throw new UIError('400', error, 'IPCSAVESHOT');
		}
	});

	ipcMain.on('save_temp_img', async (event, arg) => {
		try {
			await timerHandler.createQueue(
				'sqlite-queue',
				{
					type: 'save-failed-request',
					data: arg,
				},
				knex
			);
		} catch (error) {
			throw new UIError('400', error, 'IPCQSAVEIMG');
		}
	});

	ipcMain.on('open_setting_window', async (event, arg) => {
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');
		const auth = LocalStore.getStore('auth');
		const addSetting = LocalStore.getStore('additionalSetting');

		if (!settingWindow) {
			settingWindow = await createSettingsWindow(
				settingWindow,
				windowPath.timeTrackerUi
			);
		}
		settingWindow.show();
		settingWindow.webContents.send('app_setting', {
			...LocalStore.beforeRequestParams(),
			setting: appSetting,
			config: config,
			auth,
			additionalSetting: addSetting,
		});
		settingWindow.webContents.send('goto_top_menu');
	});

	ipcMain.on('switch_aw_option', (event, arg) => {
		const settings = LocalStore.getStore('appSetting');
		timeTrackerWindow.webContents.send('update_setting_value', settings);
	});

	ipcMain.on('logout_desktop', async (event, arg) => {
		try {
			console.log('masuk logout main');
			timeTrackerWindow.webContents.send('logout', arg);
		} catch (error) {
			console.log('Error', error);
		}
	});

	ipcMain.on('navigate_to_login', async () => {
		try {
			if (timeTrackerWindow && process.env.IS_DESKTOP_TIMER) {
				await timeTrackerWindow.loadURL(
					loginPage(windowPath.timeTrackerUi)
				);
			}
			LocalStore.updateAuthSetting({ isLogout: true });
			if (settingWindow) {
				settingWindow.webContents.send('logout_success');
			}
		} catch (error) {
			console.log('IPCQNVGLOGIN', error);
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
					window.setSize(
						isExpanded ? widthLarge : maxWidth,
						maxHeight,
						true
					);
					if (isExpanded) window.center();
				}
				break;
			default:
				{
					window.setBounds(
						{
							width: isExpanded ? widthLarge : maxWidth,
							height: maxHeight,
							x:
								(width - (isExpanded ? widthLarge : maxWidth)) *
								0.5,
							y: (height - maxHeight) * 0.5,
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
			await latestScreenshots(timeTrackerWindow);
			await countIntervalQueue(timeTrackerWindow, false);
			timeTrackerWindow.webContents.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: lastTime ? lastTime.timeslotId : null,
			});
		} catch (error) {
			timeTrackerWindow.webContents.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId: null,
			});
			throw new UIError('500', error, 'IPCREFRESH');
		}
	});

	ipcMain.on('aw_status', (event, arg) => {
		LocalStore.updateApplicationSetting({
			awIsConnected: arg,
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
				aw: arg,
			},
		});
	});

	ipcMain.on('notify', (event, notification) => {
		const notify = new NotificationDesktop();
		notify.customNotification(notification.message, notification.text);
	});

	ipcMain.on('update_session', (event, timer: TimerTO) => {
		timerHandler.timeStart = moment(timer.startedAt);
	});

	ipcMain.on('remove_current_user', async (event, arg) => {
		try {
			await userService.remove();
		} catch (error) {
			throw new UIError('500', error, 'IPCRMUSER');
		}
	});

	ipcMain.on('server-down', async (event, arg) => {
		// Check api connection
		await offlineMode.connectivity();
	});

	ipcMain.on('check-interrupted-sequences', async (event, arg) => {
		try {
			await sequentialSyncInterruptionsQueue(timeTrackerWindow);
		} catch (error) {
			throw new UIError('500', error, 'IPCCIS');
		}
	});

	ipcMain.on('check-waiting-sequences', async (event, arg) => {
		try {
			await sequentialSyncQueue(timeTrackerWindow);
		} catch (error) {
			throw new UIError('500', error, 'IPCWS');
		}
	});

	ipcMain.handle('LOGOUT_STOP', async (event, arg) => {
		try {
			return await handleLogoutDialog(timeTrackerWindow);
		} catch (error) {
			throw new UIError('500', error, 'IPCWS');
		}
	});

	ipcMain.on('preferred_language_change', (event, arg) => {
		TranslateService.preferredLanguage = arg;
	});

	TranslateService.onLanguageChange((language: string) => {
		const windows = [timeTrackerWindow, settingWindow];
		for (const window of windows) {
			window?.webContents?.send('preferred_language_change', language);
		}
	});

	ipcMain.on('show_ao', async (event, arg) => {
		const setting = LocalStore.getStore('appSetting');
		const auth = LocalStore.getStore('auth');
		if (setting?.alwaysOn && auth?.employeeId) {
			alwaysOn.show();
		}
	});

	ipcMain.on('hide_ao', (event, arg) => {
		alwaysOn.hide();
	});

	ipcMain.on('change_state_from_ao', async (event, arg) => {
		const windows = [alwaysOn.browserWindow, timeTrackerWindow];
		for (const window of windows) {
			window.webContents.send('change_state_from_ao', arg);
		}
	});

	ipcMain.on('ao_time_update', (event, arg) => {
		alwaysOn.browserWindow.webContents.send('ao_time_update', arg);
	});
}

export function removeMainListener() {
	const mainListeners = [
		'update_timer_auth_config',
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
	removeTimerHandlers();
	const timerListeners = [
		'data_push_activity',
		'remove_aw_local_data',
		'remove_wakatime_local_data',
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

export function removeAllHandlers() {
	const channels = [
		'UPDATE_SYNCED_TIMER',
		'UPDATE_SYNCED',
		'DESKTOP_CAPTURER_GET_SOURCES',
		'FINISH_SYNCED_TIMER',
		'TAKE_SCREEN_CAPTURE',
		'START_SERVER',
	];
	channels.forEach((channel: string) => {
		ipcMain.removeHandler(channel);
	});
}

export function removeTimerHandlers() {
	const channels = ['START_TIMER', 'STOP_TIMER', 'LOGOUT_STOP'];
	channels.forEach((channel: string) => {
		ipcMain.removeHandler(channel);
	});
}

let isQueueThreadTimerLocked = false;

async function sequentialSyncQueue(window: BrowserWindow) {
	if (!window) return;
	try {
		await offlineMode.connectivity();
		if (offlineMode.enabled) return;
		isQueueThreadTimerLocked = true;
		const sequences = await timerService.findToSynced();
		if (sequences.length > 0) {
			await countIntervalQueue(window, true);
			window.webContents.send('backup-timers-no-synced', sequences);
		} else {
			isQueueThreadTimerLocked = false;
		}
	} catch (error) {
		throw new UIError('500', error, 'IPCWS');
	}
}

let size = Infinity;

async function countIntervalQueue(window: BrowserWindow, inProgress: boolean) {
	if (!window) return;
	try {
		size = await intervalService.countNoSynced();
		if (size < 1) isQueueThreadTimerLocked = false;
		window.webContents.send('count-synced', { size, inProgress });
	} catch (error) {
		throw new UIError('500', error, 'IPCQCI');
	}
}

async function latestScreenshots(window: BrowserWindow): Promise<void> {
	if (!window) return;
	try {
		window.webContents.send(
			'latest_screenshots',
			await intervalService.screenshots()
		);
	} catch (error) {
		throw new UIError('500', error, 'IPCLS');
	}
}

async function sequentialSyncInterruptionsQueue(window: BrowserWindow) {
	if (!window) return;
	try {
		await offlineMode.connectivity();
		if (offlineMode.enabled) return;
		isQueueThreadTimerLocked = true;
		const sequences = await timerService.interruptions();
		if (sequences.length > 0) {
			await countIntervalQueue(window, true);
			window.webContents.send('interrupted-sequences', sequences);
		} else {
			isQueueThreadTimerLocked = false;
		}
	} catch (error) {
		throw new UIError('500', error, 'IPCCIS');
	}
}

export async function handleLogoutDialog(
	window: BrowserWindow
): Promise<boolean> {
	const dialog = new DialogStopTimerLogoutConfirmation(
		new DesktopDialog(
			process.env.DESCRIPTION,
			TranslateService.instant('TIMER_TRACKER.DIALOG.WANT_LOGOUT'),
			window
		)
	);
	const button = await dialog.show();
	return button.response === 0;
}
