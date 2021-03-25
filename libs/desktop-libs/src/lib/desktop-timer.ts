// export function desktopTimer(): string {
// 	return 'desktop-timer';
// }
import moment from 'moment';
import { Tray } from 'electron';
import { TimerData } from './desktop-timer-activity';
import { metaData } from './desktop-wakatime';
import { LocalStore } from './desktop-store';
import NotificationDesktop from './desktop-notifier';

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

	async startTimer(setupWindow, knex, timeTrackerWindow, timeLog) {
		// store timer is start to electron-store
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = true;
		LocalStore.updateApplicationSetting(appSetting);

		this.notificationDesktop.startTimeNotification(true);
		this.configs = LocalStore.getStore('configs');

		this.timeStart = moment();
		await this.createTimer(knex, timeLog);

		this.collectActivities(setupWindow, knex, timeTrackerWindow);
	}

	/*
	 * Collect windows and afk activities
	 */
	collectActivities(setupWindow, knex, timeTrackerWindow) {
		const projectInfo = LocalStore.getStore('project');
		this.intevalTimer = setInterval(() => {
			try {
				TimerData.updateDurationOfTimer(knex, {
					id: this.lastTimer.id,
					durations: moment().diff(
						moment(this.timeSlotStart),
						'milliseconds'
					)
				});

				if (projectInfo && projectInfo.aw && projectInfo.aw.isAw) {
					setupWindow.webContents.send('collect_data', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer.id
					});

					setupWindow.webContents.send('collect_afk', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer.id
					});

					setupWindow.webContents.send('collect_chrome_activities', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer.id
					});

					setupWindow.webContents.send('collect_firefox_activities', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer.id
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
		const updatePeriod = appSetting.timer.updatePeriod;

		console.log('Update Period:', updatePeriod, 60 * 1000 * updatePeriod);

		this.timeSlotStart = moment();

		this.intervalUpdateTime = setInterval(async () => {
			await this.getSetActivity(
				knex,
				setupWindow,
				this.timeSlotStart,
				false
			);
			console.log(
				'Timeslot Start Time',
				moment().format('YYYY/MM/DD HH:ss')
			);
			this.timeSlotStart = moment();
		}, 60 * 1000 * updatePeriod);
	}

	updateToggle(setupWindow, knex, isStop) {
		const params: any = {
			...LocalStore.beforeRequestParams()
		};

		if (isStop) params.manualTimeSlot = true;
		setupWindow.webContents.send('update_toggle_timer', params);
	}

	getSetTimeSlot(setupWindow, knex) {
		const { id } = this.lastTimer;
		TimerData.getTimer(knex, id).then((timerD) => {
			TimerData.getAfk(knex, id).then((afk) => {});
		});
	}

	async getSetActivity(knex, setupWindow, lastTimeSlot, quitApp) {
		const now = moment();
		const userInfo = LocalStore.beforeRequestParams();
		const appSetting = LocalStore.getStore('appSetting');
		const { id: lastTimerId, timeLogId } = this.lastTimer;

		// get aw activity
		let awActivities = await TimerData.getWindowEvent(knex, lastTimerId);

		// get waktime heartbeats
		let wakatimeHeartbeats = await metaData.getActivity(knex, {
			start: lastTimeSlot.utc().format('YYYY-MM-DD HH:mm:ss'),
			end: moment().utc().format('YYYY-MM-DD HH:mm:ss')
		});

		//get aw afk
		const awAfk = await TimerData.getAfk(knex, lastTimerId);
		let duration = awAfk.length > 0 ? awAfk[0].durations : 0;

		//calculate mouse and keyboard activity as per selected period
		duration = duration / appSetting.timer.updatePeriod;

		const idsAw = [];
		const idsWakatime = [];
		const idAfk = awAfk.length > 0 ? awAfk[0].id : null;

		// formating aw
		awActivities = awActivities.map((item) => {
			idsAw.push(item.id);
			const dataParse = JSON.parse(item.data);
			return {
				title: dataParse.title || dataParse.app,
				date: moment().format('YYYY-MM-DD'),
				time: moment().utc().format('HH:mm:ss'),
				duration: Math.floor(item.durations),
				type: item.type,
				taskId: userInfo.taskId,
				projectId: userInfo.projectId,
				organizationContactId: userInfo.organizationContactId,
				organizationId: userInfo.organizationId,
				employeeId: userInfo.employeeId,
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
				employeeId: userInfo.employeeId,
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
			timerId: lastTimerId,
			timeLogId: timeLogId,
			quitApp: quitApp
		});
	}

	stopTime(setupWindow, timeTrackerWindow, knex, quitApp) {
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = false;

		LocalStore.updateApplicationSetting(appSetting);
		this.notificationDesktop.startTimeNotification(false);

		this.updateToggle(setupWindow, knex, true);

		if (this.timeSlotStart) {
			this.getSetActivity(knex, setupWindow, this.timeSlotStart, quitApp);
			this.timeSlotStart = null;
		}

		if (this.intevalTimer) {
			clearInterval(this.intevalTimer);
			this.intevalTimer = null;
		}
		if (this.intervalUpdateTime) {
			clearInterval(this.intervalUpdateTime);
			this.intervalUpdateTime = null;
		}
	}

	async createTimer(knex, timeLog) {
		const project = LocalStore.getStore('project');
		const info = LocalStore.beforeRequestParams();

		await TimerData.createTimer(knex, {
			day: moment().format('YYYY-MM-DD'),
			updated_at: moment(),
			created_at: moment(),
			durations: 0,
			projectid: project.projectId,
			userId: info.employeeId,
			timeLogId: timeLog.id
		});

		const [lastSavedTimer] = await TimerData.getLastTimer(knex, info);
		if (lastSavedTimer) {
			this.lastTimer = lastSavedTimer;
		}
	}
}
