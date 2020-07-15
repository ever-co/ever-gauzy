import moment from 'moment';
import { Tray } from 'electron';
import { TimerData } from '../local-data/timer';
import { LocalStore } from './getSetStore';
import NotificationDesktop from './notifier';
export default class Timerhandler {
	timeRecordMinute = 0;
	timeRecordHours = 0;
	timeRecordSecond = 0;
	timeStart = null;
	trayTime: Tray;
	intevalTimer = null;
	intervalUpdateTime = null;
	lastTimer: any;
	configs: any;
	notificationDesktop = new NotificationDesktop();

	async startTimer(win2, knex, win3) {
		this.notificationDesktop.startTimeNotification(true);
		this.configs = LocalStore.getStore('configs');
		const ProjectInfo = LocalStore.getStore('project');
		this.timeStart = moment();
		this.lastTimer = await TimerData.createTimer(knex, {
			day: moment().format('YYYY-MM-DD'),
			updated_at: moment(),
			created_at: moment(),
			durations: 0,
			projectid: ProjectInfo.projectId,
			userId: ProjectInfo.taskId
		});

		const started = this.timeStart.toDate();
		const stopped = moment(started).add(10, 'seconds').utc().format();
		win2.webContents.send('set_time_log', {
			...LocalStore.beforeRequestParams(),
			timerId: this.lastTimer[0],
			startedAt: this.timeStart.utc().format(),
			stoppedAt: stopped
		});

		this.intevalTimer = setInterval(() => {
			const now = moment();
			TimerData.updateDurationOfTimer(knex, {
				id: this.lastTimer[0],
				durations: now.diff(moment(this.timeStart), 'milliseconds')
			});

			if (this.configs && this.configs.aw) {
				win2.webContents.send('collect_data', {
					start: this.timeStart.utc().format(),
					end: moment().utc().format(),
					tpURL: this.configs.awAPI,
					tp: 'aw',
					timerId: this.lastTimer[0]
				});

				win2.webContents.send('collect_afk', {
					start: this.timeStart.utc().format(),
					end: moment().utc().format(),
					tpURL: this.configs.awAPI,
					tp: 'aw',
					timerId: this.lastTimer[0]
				});
			}

			this.calculateTimeRecord();
			win3.webContents.send('timer_push', {
				second: this.timeRecordSecond,
				minute: this.timeRecordMinute,
				hours: this.timeRecordHours
			});
		}, 1000);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordSecond = now.diff(moment(this.timeStart), 'seconds');
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	updateTime(win2, knex) {
		this.intervalUpdateTime = setInterval(() => {
			this.getSetActivity(knex, win2);
			this.getSetTimeSlot(win2, knex);
		}, 60 * 1000 * 5);
	}

	getSetTimeSlot(win2, knex) {
		TimerData.getTimer(knex, this.lastTimer[0]).then((timerD) => {
			TimerData.getAfk(knex, this.lastTimer[0]).then((afk) => {
				win2.webContents.send('set_time_slot', {
					...LocalStore.beforeRequestParams(),
					duration: this.timeRecordSecond,
					keyboard: afk && afk.length > 0 ? afk[0].durations : 0,
					mouse: afk && afk.length > 0 ? afk[0].durations : 0,
					overall: afk && afk.length > 0 ? afk[0].durations : 0,
					startedAt: this.timeStart.utc().format(),
					timerId: this.lastTimer[0]
				});

				// win2.webContents.send('update_time_slot', {
				// 	duration: this.timeRecordSecond,
				// 	keyboard: afk && afk.length > 0 ? afk[0].durations : 0,
				// 	mouse: afk && afk.length > 0 ? afk[0].durations : 0,
				// 	overall: afk && afk.length > 0 ? afk[0].durations : 0,
				// 	timeSlotId: timerD[0].timeSlotId,
				// 	token: auth.token,
				// 	timerId: this.lastTimer[0],
				// 	apiHost: LocalStore.getServerUrl()
				// });
			});
		});
	}

	getSetActivity(knex, win2) {
		TimerData.getWindowEvent(knex, this.lastTimer[0]).then((events) => {
			console.log('result of acti', events);
			events.map((item) => {
				if (item.activityId) {
					win2.webContents.send('update_to_activity', {
						duration: Math.floor(item.durations),
						activityId: item.activityId,
						...LocalStore.beforeRequestParams()
					});
				} else {
					win2.webContents.send('set_activity', {
						...LocalStore.beforeRequestParams(),
						title: JSON.parse(item.data).app,
						date: moment().format('YYY-MM-DD'),
						duration: Math.floor(item.durations),
						type: 'app',
						eventId: item.eventId
					});
				}
			});
		});
	}

	stopTime(win2, win3, knex) {
		this.notificationDesktop.startTimeNotification(false);
		TimerData.getTimer(knex, this.lastTimer[0]).then((logTime) => {
			console.log('time stop log', logTime);
			win2.webContents.send('update_time_log_stop', {
				...LocalStore.beforeRequestParams(),
				startedAt: this.timeStart.utc().format(),
				stoppedAt: moment().utc().format(),
				timeLogId: logTime[0].timeLogId
			});
		});
		clearInterval(this.intevalTimer);
		clearInterval(this.intervalUpdateTime);
	}
}
