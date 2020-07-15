import { ipcMain } from 'electron';
import { TimerData } from '../local-data/timer';
import TimerHandler from './timer';
import moment from 'moment';
export function ipcMainHandler(store, startServer, knex, win2, win3) {
	const timerHandler = new TimerHandler();
	ipcMain.on('start_server', (event, arg) => {
		global.variableGlobal = {
			API_BASE_URL: arg.serverUrl
				? arg.serverUrl
				: arg.port
				? `http://localhost:${arg.port}`
				: 'http://localhost:3000'
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
				activityId: null
			};
			TimerData.insertWindowEvent(knex, events);
		});
	});

	ipcMain.on('data_push_afk', (event, arg) => {
		arg.afk.forEach((item) => {
			const now = moment().utc();
			const afkDuration = now.diff(moment(arg.start).utc(), 'seconds');
			console.log('now time', now);
			console.log('time start afk from aw', item.start);
			console.log('duration from start afk to now', afkDuration);
			console.log('afk duration from aw', item.duration);
			if (afkDuration < item.duration) {
				item.duration = afkDuration;
			}
			const afk_new = {
				eventId: item.id,
				durations: item.duration,
				timerId: arg.timerId,
				data: item.data,
				created_at: new Date(),
				updated_at: new Date(),
				timeSlotId: null,
				timeSheetId: null
			};

			TimerData.insertAfkEvent(knex, afk_new);
		});
	});

	ipcMain.on('return_activity', (event, arg) => {
		TimerData.updateWindowEventUpload(knex, {
			eventId: arg.eventId,
			activityId: arg.activityId
		});
	});

	ipcMain.on('start_timer', (event, arg) => {
		store.set({
			project: {
				projectId: arg.projectId,
				taskId: arg.taskId
			}
		});
		timerHandler.startTimer(win2, knex, win3);
		timerHandler.updateTime(win2, knex);
	});

	ipcMain.on('stop_timer', (event, arg) => {
		timerHandler.stopTime(win2, win3, knex);
	});

	ipcMain.on('auth_success', (event, arg) => {
		store.set({
			auth: arg
		});
	});

	ipcMain.on('return_time_slot', (event, arg) => {
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeSlotId: arg.timeSlotId
		});
	});

	ipcMain.on('return_time_sheet', (event, arg) => {
		console.log('timesheet return', arg);
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeSheetId: arg.timeSheetId,
			timeLogId: arg.timeLogId
		});
	});

	ipcMain.on('return_time_log', (event, arg) => {
		TimerData.updateTimerUpload(knex, {
			id: arg.timerId,
			timeLogId: arg.timeLogId
		});
	});
}
