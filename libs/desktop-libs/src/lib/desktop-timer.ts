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

	startTimer(setupWindow, knex, timeTrackerWindow, timeLog) {
		// store timer is start to electron-store
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = true;
		LocalStore.updateApplicationSetting(appSetting);

		this.notificationDesktop.timerActionNotification(true);
		this.configs = LocalStore.getStore('configs');

		this.timeStart = moment();

		(async () => {
			await this.createTimer(knex, timeLog);
			this.collectActivities(setupWindow, knex, timeTrackerWindow);

			/*
			 * Start time interval for get set activities and screenshots
			 */
			this.startTimerIntervalPeriod(setupWindow, knex);

			/*
			 * Create screenshots at begining of timer
			 */
			(async () => {
				await this.makeScreenshot(setupWindow, knex, false);
			})();
		})();
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

	startTimerIntervalPeriod(setupWindow, knex) {
		const appSetting = LocalStore.getStore('appSetting');
		const updatePeriod = appSetting.timer.updatePeriod;
		console.log('Update Period:', updatePeriod, 60 * 1000 * updatePeriod);

		this.timeSlotStart = moment();
		console.log('Timeslot Start Time', this.timeSlotStart);

		this.intervalUpdateTime = setInterval(async () => {
			console.log('Last Time Id:', this.lastTimer.id);

			await this.getSetActivity(
				knex,
				setupWindow,
				this.timeSlotStart,
				false
			);
			console.log('Timeslot Start Time', this.timeSlotStart);
			this.timeSlotStart = moment();
		}, 60 * 1000 * updatePeriod);
	}

	/*
	 * Stop timer interval period after stop timer
	 */
	stopTimerIntervalPeriod() {
		if (this.intevalTimer) {
			clearInterval(this.intevalTimer);
			this.intevalTimer = null;
		}
		if (this.intervalUpdateTime) {
			clearInterval(this.intervalUpdateTime);
			this.intervalUpdateTime = null;
		}

		console.log('Stop Timer Interval Period:', this.timeSlotStart, this.intevalTimer, this.intervalUpdateTime);
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
				date: moment().utc().format('YYYY-MM-DD'),
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
		this.notificationDesktop.timerActionNotification(false);

		this.updateToggle(setupWindow, knex, true);

		/*
		 * Create screenshots at end of timer
		 */
		(async () => {
			await this.makeScreenshot(setupWindow, knex, true);

			/*
			 * Stop time interval after stop timer
			 */
			this.stopTimerIntervalPeriod();
		})();
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
			timeLogId: timeLog ? timeLog.id : null
		});

		const [lastSavedTimer] = await TimerData.getLastTimer(knex, info);
		if (lastSavedTimer) {
			this.lastTimer = lastSavedTimer;
		}
	}

	/*
	 * Make screenshots and activities after start and stop timer
	 */
	async makeScreenshot(setupWindow, knex, quitApp) {
		console.log(
			`Time Slot Start/End At ${quitApp ? 'End' : 'Begining'}`,
			this.timeSlotStart
		);
		if (this.timeSlotStart) {
			await this.getSetActivity(
				knex,
				setupWindow,
				this.timeSlotStart,
				quitApp
			);
		}
	}
}
