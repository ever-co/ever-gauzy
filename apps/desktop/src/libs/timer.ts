import moment from 'moment';
import { Tray } from 'electron';
import { TimerData } from '../local-data/timer';
import { LocalStore } from './getSetStore';
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

	async startTimer(win2, knex, win3) {
		this.configs = LocalStore.getStore('configs');
		const ProjectInfo = LocalStore.getStore('project');
		const auth = LocalStore.getStore('auth');
		this.timeStart = moment();
		this.lastTimer = await TimerData.createTimer(knex, {
			day: moment().format('YYYY-MM-DD'),
			updated_at: moment(),
			created_at: moment(),
			durations: 0,
			projectid: ProjectInfo.projectId,
			userId: ProjectInfo.taskId
		});
		win2.webContents.send('set_time_slot', {
			token: auth.token,
			employeeId: auth.employeeId,
			duration: 0,
			keyboard: 0,
			mouse: 0,
			overall: 0,
			startedAt: this.timeStart.utc().format(),
			timerId: this.lastTimer[0],
			apiHost: LocalStore.getServerUrl()
		});
		win2.webContents.send('set_time_sheet', {
			token: auth.token,
			employeeId: auth.employeeId,
			duration: 0,
			keyboard: 0,
			mouse: 0,
			overall: 0,
			startedAt: this.timeStart.utc().format(),
			timerId: this.lastTimer[0],
			stoppedAt: this.timeStart.utc().format(),
			projectId: ProjectInfo.projectId,
			taskId: ProjectInfo.taskId,
			apiHost: LocalStore.getServerUrl()
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

			this.getSetTimeSlot(win2, knex, auth);
		}, 1000);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordSecond = now.diff(moment(this.timeStart), 'seconds');
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	updateTime(win2, knex) {
		const auth = LocalStore.getStore('auth');
		const projectInfo = LocalStore.getStore('project');
		this.intervalUpdateTime = setInterval(() => {
			this.getSetActivity(knex, win2, auth, projectInfo);
		}, 60 * 1000);
	}

	getSetTimeSlot(win2, knex, auth) {
		TimerData.getTimer(knex, this.lastTimer[0]).then((timerD) => {
			TimerData.getAfk(knex, this.lastTimer[0]).then((afk) => {
				win2.webContents.send('update_time_slot', {
					duration: this.timeRecordSecond,
					keyboard: afk && afk.length > 0 ? afk[0].durations : 0,
					mouse: afk && afk.length > 0 ? afk[0].durations : 0,
					overall: afk && afk.length > 0 ? afk[0].durations : 0,
					timeSlotId: timerD[0].timeSlotId,
					token: auth.token,
					timerId: this.lastTimer[0],
					apiHost: LocalStore.getServerUrl()
				});

				win2.webContents.send('update_time_sheet', {
					duration: this.timeRecordSecond,
					keyboard: afk && afk.length > 0 ? afk[0].durations : 0,
					mouse: afk && afk.length > 0 ? afk[0].durations : 0,
					overall: afk && afk.length > 0 ? afk[0].durations : 0,
					timeSheetId: timerD[0].timeSheetId,
					token: auth.token,
					timerId: this.lastTimer[0],
					timeLogId: timerD[0].timeLogId,
					stoppedAt: moment().utc().format(),
					apiHost: LocalStore.getServerUrl()
				});
			});
		});
	}

	getSetActivity(knex, win2, auth, projectInfo) {
		TimerData.getWindowEvent(knex, this.lastTimer[0]).then((events) => {
			console.log('result of acti', events);
			events.map((item) => {
				if (item.activityId) {
					win2.webContents.send('update_to_activity', {
						duration: Math.floor(item.durations),
						activityId: item.activityId,
						token: auth.token,
						apiHost: LocalStore.getServerUrl()
					});
				} else {
					win2.webContents.send('set_activity', {
						employeeId: auth.employeeId,
						projectId: projectInfo.projectId,
						taskId: projectInfo.taskId,
						title: JSON.parse(item.data).app,
						date: moment().format('YYY-MM-DD'),
						duration: Math.floor(item.durations),
						type: 'app',
						eventId: item.eventId,
						token: auth.token,
						apiHost: LocalStore.getServerUrl()
					});
				}
			});
		});
	}

	stopTime() {
		clearInterval(this.intevalTimer);
		clearInterval(this.intervalUpdateTime);
	}
}
