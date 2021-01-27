import { ipcMain, screen } from 'electron';
import { TimerData } from './desktop-timer-activity';
import { metaData } from './desktop-wakatime';
import TimerHandler from './desktop-timer';
import moment from 'moment';
import { LocalStore } from './desktop-store';
import { takeshot, captureScreen } from './desktop-screenchot';
import { environment } from '../../../../apps/desktop/src/environments/environment';
import {
	hasPromptedForPermission,
	hasScreenCapturePermission,
	openSystemPreferences
} from 'mac-screen-capture-permissions';
export function ipcMainHandler(store, startServer, knex) {
	ipcMain.on('start_server', (event, arg) => {
		global.variableGlobal = {
			API_BASE_URL: arg.serverUrl
				? arg.serverUrl
				: arg.port
				? `http://localhost:${arg.port}`
				: `http://localhost:${environment.API_DEFAULT_PORT}`,
			IS_INTEGRATED_DESKTOP: arg.isLocalServer
		};
		startServer(arg);
	});

	ipcMain.on('data_push_activity', (event, arg) => {
		arg.windowEvent.forEach((item) => {
			const events = {
				eventId: item.id,
				timerId: arg.timerId,
				durations: item.duration,
				data: JSON.stringify(item.data),
				created_at: new Date(),
				updated_at: new Date(),
				activityId: null,
				type: arg.type
			};
			TimerData.insertWindowEvent(knex, events);
		});
	});

	ipcMain.on('data_push_afk', (event, arg) => {
		arg.afk.forEach((item) => {
			const now = moment().utc();
			const afkDuration = now.diff(moment(arg.start).utc(), 'seconds');
			if (afkDuration < item.duration) {
				item.duration = afkDuration;
			}
			const afk_new = {
				eventId: item.id,
				durations: item.duration,
				timerId: arg.timerId,
				data: JSON.stringify(item.data),
				created_at: new Date(),
				updated_at: new Date(),
				timeSlotId: null,
				timeSheetId: null
			};

			TimerData.insertAfkEvent(knex, afk_new);
		});
	});

	ipcMain.on('remove_aw_local_data', (event, arg) => {
		TimerData.deleteWindowEventAfterSended(knex, {
			activityIds: arg.idsAw
		});
	});

	ipcMain.on('remove_wakatime_local_data', (event, arg) => {
		metaData.removeActivity(knex, {
			idsWakatime: arg.idsWakatime
		});
	});

	ipcMain.on('remove_afk_local_Data', (event, arg) => {
		TimerData.deleteAfk(knex, {
			idAfk: arg.idAfk
		});
	});

	ipcMain.on('return_time_sheet', (event, arg) => {
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeSheetId: arg.timeSheetId,
			timeLogId: arg.timeLogId
		});
	});

	ipcMain.on('return_toggle_api', (event, arg) => {
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeLogId: arg.result.id
		});
	});

	ipcMain.on('set_project_task', (event, arg) => {
		event.sender.send('set_project_task_reply', arg);
	});

	ipcMain.on('time_tracker_ready', async (event, arg) => {
		const auth = LocalStore.getStore('auth');
		if (auth) {
			const lastTime: any = await TimerData.getLastTimer(
				knex,
				LocalStore.beforeRequestParams()
			);
			event.sender.send('timer_tracker_show', {
				...LocalStore.beforeRequestParams(),
				timeSlotId:
					lastTime && lastTime.length > 0
						? lastTime[0].timeSlotId
						: null
			});
		}
	});

	ipcMain.on('screen_shoot', (event, arg) => {
		event.sender.send('take_screen_shoot');
	});

	ipcMain.on('get_last_screen_capture', (event, arg) => {
		event.sender.send('get_last_screen');
	});

	ipcMain.on('update_app_setting', (event, arg) => {
		LocalStore.updateApplicationSetting(arg.values);
	});

	ipcMain.on('request_permission', async (event) => {
		try {
			if (process.platform === 'darwin') {
				const screenCapturePermission = hasScreenCapturePermission();
				if (!screenCapturePermission) {
					if (!hasPromptedForPermission()) {
						await openSystemPreferences();
					}
				}
			}
		} catch (error) {
			console.log('error opening permission', error.message);
		}
	});
}

export function ipcTimer(
	store,
	knex,
	setupWindow,
	timeTrackerWindow,
	NotificationWindow,
	SettingWindow,
	imageView
) {
	const timerHandler = new TimerHandler();
	ipcMain.on('start_timer', (event, arg) => {
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
		timerHandler.updateTime(setupWindow, knex, timeTrackerWindow);
		SettingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
		});
	});

	ipcMain.on('stop_timer', (event, arg) => {
		timerHandler.stopTime(
			setupWindow,
			timeTrackerWindow,
			knex,
			arg.quitApp
		);
		SettingWindow.webContents.send('app_setting_update', {
			setting: LocalStore.getStore('appSetting')
		});
	});

	ipcMain.on('return_time_slot', (event, arg) => {
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeSlotId: arg.timeSlotId
		});
		timeTrackerWindow.webContents.send(
			'refresh_time_log',
			LocalStore.beforeRequestParams()
		);
		// after update time slot do upload screenshot
		// check config
		const appSetting = LocalStore.getStore('appSetting');
		switch (
			appSetting.SCREENSHOTS_ENGINE_METHOD ||
			environment.SCREENSHOTS_ENGINE_METHOD
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
					NotificationWindow,
					arg.timeSlotId,
					arg.quitApp
				);
				break;
			default:
				break;
		}
	});

	ipcMain.on('save_screen_shoot', (event, arg) => {
		takeshot(timeTrackerWindow, arg, NotificationWindow);
	});

	ipcMain.on('show_image', (event, arg) => {
		imageView.show();
		imageView.webContents.send('show_image', arg);
	});

	ipcMain.on('close_image_view', () => {
		imageView.hide();
	});
}
