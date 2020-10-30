import moment from 'moment';
import { Tray } from 'electron';
import { TimerData } from '../local-data/timer';
import { metaData } from '../local-data/coding-activity';
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
	timeSlotStart = null;

	async startTimer(setupWindow, knex, timeTrackerWindow) {
		// store timer is start to electron-store
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = true;
		LocalStore.updateApplicationSetting(appSetting);

		this.notificationDesktop.startTimeNotification(true);
		this.configs = LocalStore.getStore('configs');
		const ProjectInfo = LocalStore.getStore('project');
		const appInfo = LocalStore.beforeRequestParams();
		this.timeStart = moment();
		this.timeSlotStart = moment();
		this.lastTimer = await TimerData.createTimer(knex, {
			day: moment().format('YYYY-MM-DD'),
			updated_at: moment(),
			created_at: moment(),
			durations: 0,
			projectid: ProjectInfo.projectId,
			userId: appInfo.employeeId
		});

		setupWindow.webContents.send('time_toggle', {
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
					setupWindow.webContents.send('collect_data', {
						start: this.timeStart.utc().format(),
						end: moment().utc().format(),
						tpURL: ProjectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer[0]
					});

					setupWindow.webContents.send('collect_afk', {
						start: this.timeStart.utc().format(),
						end: moment().utc().format(),
						tpURL: ProjectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer[0]
					});
				}

				this.calculateTimeRecord();
				timeTrackerWindow.webContents.send('timer_push', {
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

	updateTime(setupWindow, knex, timeTrackerWindow) {
		const appSetting = LocalStore.getStore('appSetting');
		this.intervalUpdateTime = setInterval(() => {
			this.getSetActivity(knex, setupWindow, this.timeSlotStart, false);
			this.timeSlotStart = moment();
		}, 60 * 1000 * appSetting.timer.updatePeriode);
	}

	updateToggle(setupWindow, knex, isStop) {
		const params: any = {
			...LocalStore.beforeRequestParams(),
			timerId: this.lastTimer[0]
		};
		if (isStop) params.manualTimeSlot = true;
		setupWindow.webContents.send('update_toggle_timer', params);
	}

	getSetTimeSlot(setupWindow, knex) {
		TimerData.getTimer(knex, this.lastTimer[0]).then((timerD) => {
			TimerData.getAfk(knex, this.lastTimer[0]).then((afk) => {});
		});
	}

	async getSetActivity(knex, setupWindow, lastTimeSlot, quitApp) {
		const now = moment();
		const userInfo = LocalStore.beforeRequestParams();
		const lastSavedTime = await TimerData.getLastTimer(knex, userInfo);
		// get aw activity
		let awActivities = await TimerData.getWindowEvent(
			knex,
			this.lastTimer[0]
		);
		// get waktime heartbeats
		let wakatimeHeartbeats = await metaData.getActivity(knex, {
			start: lastTimeSlot.utc().format('YYYY-MM-DD HH:mm:ss'),
			end: moment().utc().format('YYYY-MM-DD HH:mm:ss')
		});
		//get aw afk
		const awAfk = await TimerData.getAfk(knex, this.lastTimer[0]);
		const duration = awAfk.length > 0 ? awAfk[0].durations : 0;

		const idsAw = [];
		const idsWakatime = [];
		const idAfk = awAfk.length > 0 ? awAfk[0].id : null;

		// formating aw
		awActivities = awActivities.map((item) => {
			idsAw.push(item.id);
			return {
				title: JSON.parse(item.data).app,
				date: moment().format('YYYY-MM-DD'),
				time: moment().utc().format('HH:mm:ss'),
				duration: Math.floor(item.durations),
				type: 'APP',
				taskId: userInfo.taskId,
				projectId: userInfo.projectId,
				organizationContactId: userInfo.organizationContactId,
				organizationId: userInfo.organizationId,
				source: 'DESKTOP'
			};
		});

		//formating wakatime
		wakatimeHeartbeats = wakatimeHeartbeats.map((item) => {
			idsWakatime.push(item.id);
			const activityMetadata = {
				type: item.type,
				dependecies: item.dependencies,
				language: item.languages,
				project: item.projects,
				branches: item.branches,
				entity: item.entities,
				line: item.lines
			};
			return {
				title: item.editors,
				date: moment.unix(item.time).format('YYYY-MM-DD'),
				time: moment.unix(item.time).format('HH:mm:ss'),
				duration: 0,
				type: 'APP',
				taskId: userInfo.taskId,
				organizationId: userInfo.organizationId,
				projectId: userInfo.projectId,
				organizationContactId: userInfo.organizationContactId,
				metaData:
					this.configs && this.configs.db === 'sqlite'
						? JSON.stringify(activityMetadata)
						: activityMetadata
			};
		});

		const allActivities = [...awActivities, ...wakatimeHeartbeats];

		// send Activity to gauzy
		setupWindow.webContents.send('set_time_slot', {
			...userInfo,
			duration: now.diff(moment(lastTimeSlot), 'seconds'),
			keyboard: Math.round(duration),
			mouse: Math.round(duration),
			overall: Math.round(duration),
			startedAt: lastTimeSlot.utc().toDate(),
			activities: allActivities,
			idsAw: idsAw,
			idsWakatime: idsWakatime,
			idAfk: idAfk,
			timerId: this.lastTimer[0],
			timeLogId: lastSavedTime[0].timeLogId,
			quitApp: quitApp
		});
	}

	stopTime(setupWindow, timeTrackerWindow, knex, quitApp) {
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = false;
		LocalStore.updateApplicationSetting(appSetting);
		this.notificationDesktop.startTimeNotification(false);
		this.updateToggle(setupWindow, knex, true);
		this.getSetActivity(knex, setupWindow, this.timeSlotStart, quitApp);
		clearInterval(this.intevalTimer);
		clearInterval(this.intervalUpdateTime);
	}
}
