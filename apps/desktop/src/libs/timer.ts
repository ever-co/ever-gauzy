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

		win2.webContents.send('time_toggle', {
			...LocalStore.beforeRequestParams(),
			timerId: this.lastTimer[0]
		});

		this.intevalTimer = setInterval(() => {
			try {
				const now = moment();
				TimerData.updateDurationOfTimer(knex, {
					id: this.lastTimer[0],
					durations: now.diff(moment(this.timeStart), 'milliseconds')
				});

				if (ProjectInfo && ProjectInfo.aw && ProjectInfo.aw.isAw) {
					win2.webContents.send('collect_data', {
						start: this.timeStart.utc().format(),
						end: moment().utc().format(),
						tpURL: ProjectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer[0]
					});

					win2.webContents.send('collect_afk', {
						start: this.timeStart.utc().format(),
						end: moment().utc().format(),
						tpURL: ProjectInfo.aw.host,
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
			} catch (error) {
				console.log('errr', error);
			}
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
			this.updateToggle(win2, knex);
		}, 60 * 1000 * 5);
	}

	updateToggle(win2, knex) {
		win2.webContents.send('update_toggle_timer', {
			...LocalStore.beforeRequestParams(),
			timerId: this.lastTimer[0]
		});
	}

	getSetTimeSlot(win2, knex) {
		TimerData.getTimer(knex, this.lastTimer[0]).then((timerD) => {
			TimerData.getAfk(knex, this.lastTimer[0]).then((afk) => {});
		});
	}

	getSetActivity(knex, win2) {
		TimerData.getWindowEvent(knex, this.lastTimer[0]).then((events) => {
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
						date: moment().format('YYYY-MM-DD'),
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
		this.updateToggle(win2, knex);
		clearInterval(this.intevalTimer);
		clearInterval(this.intervalUpdateTime);
	}
}
