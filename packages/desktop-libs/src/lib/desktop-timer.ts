import moment from 'moment';
import { app, screen } from 'electron';
import { TimerData } from './desktop-timer-activity';
import { metaData } from './desktop-wakatime';
import { LocalStore } from './desktop-store';
import NotificationDesktop from './desktop-notifier';
import { detectActiveWindow, getScreenshot } from './desktop-screenshot';
import log from 'electron-log';
import { ActivityType, TimeLogSourceEnum } from '@gauzy/contracts';
import { DesktopEventCounter } from './desktop-event-counter';
import { DesktopActiveWindow } from './desktop-active-window';
import { DesktopOfflineModeHandler, Timer, TimerService } from './offline';
import { IOfflineMode } from './interfaces';

console.log = log.log;
Object.assign(console, log.functions);
const EmbeddedQueue = require('embedded-queue');

export default class TimerHandler {
	timeRecordMinute = 0;
	timeRecordHours = 0;
	timeRecordSecond = 0;
	timeStart = null;
	intervalTimer = null;
	intervalUpdateTime = null;
	lastTimer: any;
	configs: any;
	notificationDesktop = new NotificationDesktop();
	timeSlotStart = null;
	isPaused = true;
	listener = false;
	nextScreenshot = 0;
	queue: any = null;
	queueType: any = {};
	appName = app.getName();
	_eventCounter = new DesktopEventCounter();
	private _activeWindow = new DesktopActiveWindow();
	private _activities = [];
	private _offlineMode: IOfflineMode = DesktopOfflineModeHandler.instance;
	private _timerService = new TimerService();

	constructor() {
		/**
		 * Handle windows change
		 */
		this._activeWindow.on('updated', async (win) => {
			try {
				this._activities.push({ ...win });
			} catch (e) {
				console.log('Error on handle window', e);
			}
		});
	}

	async startTimer(setupWindow, knex, timeTrackerWindow, timeLog) {
		this._activities = [];
		this._eventCounter.start();
		this._activeWindow.start();

		const appSetting = LocalStore.getStore('appSetting');

		appSetting.timerStarted = true;
		LocalStore.updateApplicationSetting(appSetting);

		this.notificationDesktop.timerActionNotification(true);
		this.configs = LocalStore.getStore('configs');

		if (appSetting.randomScreenshotTime) {
			this.nextScreenshot = 0;
			this.timeSlotStart = moment();
			this.nextTickScreenshot();
		}

		this.timeStart = moment();


		await this.createTimer(knex, timeLog);
		this.collectActivities(setupWindow, knex, timeTrackerWindow);

		/*
			* Start time interval for get set activities and screenshots
			*/
		if (!appSetting.randomScreenshotTime) {
			await this.startTimerIntervalPeriod(setupWindow, knex, timeTrackerWindow);
		}

		const lastTimer = await TimerData.getLastTimer(knex, null);
		timeTrackerWindow.webContents.send('toggle_timer_state', {
			isStarted: true,
			lastTimer: lastTimer
		});
	}

	/*
	 * Collect windows and afk activities
	 */
	collectActivities(setupWindow, knex, timeTrackerWindow) {
		this.intervalTimer = setInterval(async () => {
			try {
				const projectInfo = LocalStore.getStore('project');
				const appSetting = LocalStore.getStore('appSetting');
				await this.createQueue(
					'sqlite-queue-gauzy-desktop-timer',
					{
						type: 'update-duration-timer',
						data: {
							id: this.lastTimer ? this.lastTimer.id : null,
							duration: moment().diff(moment(this.timeStart), 'milliseconds')
						}
					},
					knex
				);
				if (projectInfo && projectInfo.aw && projectInfo.aw.isAw && appSetting.awIsConnected) {
					setupWindow.webContents.send('collect_data', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer ? this.lastTimer.id : null
					});

					setupWindow.webContents.send('collect_afk', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer ? this.lastTimer.id : null
					});

					setupWindow.webContents.send('collect_chrome_activities', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer ? this.lastTimer.id : null
					});

					setupWindow.webContents.send('collect_firefox_activities', {
						start: this.timeSlotStart.utc().format(),
						end: moment().utc().format(),
						tpURL: projectInfo.aw.host,
						tp: 'aw',
						timerId: this.lastTimer ? this.lastTimer.id : null
					});
				}

				this.calculateTimeRecord();
				timeTrackerWindow.webContents.send('timer_push', {
					second: this.timeRecordSecond,
					minute: this.timeRecordMinute,
					hours: this.timeRecordHours
				});

				if (appSetting.randomScreenshotTime) {
					if (this.nextScreenshot === this.timeRecordSecond) {
						await this.randomScreenshotUpdate(setupWindow, knex, timeTrackerWindow);
					}
				}
			} catch (error) {
				console.log('error', error);
			}
		}, 1000);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordSecond = now.diff(moment(this.timeStart), 'seconds');
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	async randomScreenshotUpdate(setupWindow, knex, timeTrackerWindow) {
		await this.getSetActivity(knex, setupWindow, this.timeSlotStart, timeTrackerWindow, false);
		this.nextTickScreenshot();
		console.log('Timeslot Start Time', this.timeSlotStart);
		this.timeSlotStart = moment();
	}

	async startTimerIntervalPeriod(setupWindow, knex, timeTrackerWindow) {
		const appSetting = LocalStore.getStore('appSetting');
		const updatePeriod = appSetting.timer.updatePeriod;
		console.log('Update Period:', updatePeriod, 60 * 1000 * updatePeriod);

		this.timeSlotStart = moment();
		console.log('Timeslot Start Time', this.timeSlotStart);
		await this._timerService.update(
			new Timer({
				id: this.lastTimer ? this.lastTimer.id : null,
				startedAt: new Date(),
				synced: !this._offlineMode.enabled,
				isStartedOffline: this._offlineMode.enabled
			})
		);
		this.intervalUpdateTime = setInterval(async () => {
			console.log('Last Timer Id:', this.lastTimer ? this.lastTimer.id : null);
			await this.getSetActivity(knex, setupWindow, this.timeSlotStart, timeTrackerWindow, false);
			console.log('Timeslot Start Time', this.timeSlotStart);
			this.timeSlotStart = moment();
		}, 60 * 1000 * updatePeriod);
	}

	nextTickScreenshot() {
		const appSetting = LocalStore.getStore('appSetting');
		const updatePeriod = appSetting.timer.updatePeriod;
		const tickAdd = this.maxMinAdditionalTime(updatePeriod);
		const randomSecond = Math.floor(Math.random() * (tickAdd.max - tickAdd.min)) + tickAdd.min;
		this.nextScreenshot = this.nextScreenshot + randomSecond;
	}

	maxMinAdditionalTime(updatePeriod) {
		switch (updatePeriod) {
			case 1:
				return {
					max: updatePeriod * 60 + 20,
					min: updatePeriod * 60 - 20
				};
			case 5:
				return {
					max: updatePeriod * 60 + 60,
					min: updatePeriod * 60 - 60
				};
			case 10:
				return {
					max: updatePeriod * 60 + 60,
					min: updatePeriod * 60 - 20
				};
			default:
				return {
					max: updatePeriod * 60 + updatePeriod * 2,
					min: updatePeriod * 60 - updatePeriod / 2
				};
		}
	}

	/*
	 * Stop timer interval period after stop timer
	 */
	async stopTimerIntervalPeriod() {
		try {
			this._eventCounter.stop();
			if (this._activeWindow.active) await this._activeWindow.stop();
			clearInterval(this.intervalTimer);
			clearInterval(this.intervalUpdateTime);
			await this._timerService.update(
				new Timer({
					id: this.lastTimer ? this.lastTimer.id : null,
					stoppedAt: new Date(),
					synced: !this._offlineMode.enabled,
					isStoppedOffline: this._offlineMode.enabled
				})
			);
		} catch (error) {
			console.log('error on clear all intervals for timer');
		}
		console.log('Stop Timer Interval Period:', this.timeSlotStart, this.intervalTimer, this.intervalUpdateTime);
	}

	updateToggle(setupWindow, knex, isStop) {
		const params: any = {
			...LocalStore.beforeRequestParams()
		};

		if (isStop) params.manualTimeSlot = true;
		setupWindow.webContents.send('update_toggle_timer', params);
	}

	async getSetTimeSlot(setupWindow, knex) {
		const id = this.lastTimer ? this.lastTimer.id : null;
		await TimerData.getTimer(knex, id);
		await TimerData.getAfk(knex, id);
	}

	async getSetActivity(knex, setupWindow, lastTimeSlot, timeTrackerWindow, quitApp) {
		// get aw activity
		try {
			const dataCollection = await this.activitiesCollection(knex, lastTimeSlot);
			await this.takeScreenshotActivities(timeTrackerWindow, lastTimeSlot, dataCollection);
		} catch (error) {
			console.log('Get AW activity Error', error);
		}
	}

	async activitiesCollection(knex, lastTimeSlot) {
		const userInfo = LocalStore.beforeRequestParams();
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');

		log.info(`App Setting: ${moment().format()}`, appSetting);
		log.info(`Config: ${moment().format()}`, config);

		const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
		let awActivities = await TimerData.getWindowEvent(knex, lastTimerId);

		// get wakatime heartbeats
		let wakatimeHeartbeats = await metaData.getActivity(knex, {
			start: lastTimeSlot.utc().format('YYYY-MM-DD HH:mm:ss'),
			end: moment().utc().format('YYYY-MM-DD HH:mm:ss')
		});

		//get aw afk
		const awAfk = await TimerData.getAfk(knex, lastTimerId);
		const durationAfk: number = this.afkCount(awAfk);

		//calculate mouse and keyboard activity as per selected period

		let idsAw = [];
		const idsWakatime = [];
		const idsAfk = awAfk.length > 0 ? awAfk.map((afk) => afk.id) : [];
		idsAw = [...idsAfk, ...idsAw];

		// formatting window activities
		this._activities = this._activities
			.map((item) => {
				return item.data
					? {
						title: item.data.app || item.data.title,
						date: moment(item.timestamp).utc().format('YYYY-MM-DD'),
						time: moment(item.timestamp).utc().format('HH:mm:ss'),
						duration: Math.floor(item.duration),
						type: item.data.url ? ActivityType.URL : ActivityType.APP,
						taskId: userInfo.taskId,
						projectId: userInfo.projectId,
						organizationContactId: userInfo.organizationContactId,
						organizationId: userInfo.organizationId,
						employeeId: userInfo.employeeId,
						source: TimeLogSourceEnum.DESKTOP,
						recordedAt: moment(item.timestamp).utc().toDate(),
						metaData: item.data
					}
					: null;
			})
			.filter((item) => !!item);

		// formatting aw
		awActivities = awActivities.map((item) => {
			idsAw.push(item.id);
			const dataParse = JSON.parse(item.data);
			return {
				title: dataParse.title || dataParse.app,
				date: moment().utc().format('YYYY-MM-DD'),
				time: moment().utc().format('HH:mm:ss'),
				duration: Math.floor(item.duration),
				type: item.type,
				taskId: userInfo.taskId,
				projectId: userInfo.projectId,
				organizationContactId: userInfo.organizationContactId,
				organizationId: userInfo.organizationId,
				employeeId: userInfo.employeeId,
				source: TimeLogSourceEnum.DESKTOP,
				recordedAt: moment(new Date(item.created_at)).utc().toDate(),
				metaData: dataParse
			};
		});

		//formatting wakatime
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
				type: ActivityType.APP,
				taskId: userInfo.taskId,
				organizationId: userInfo.organizationId,
				projectId: userInfo.projectId,
				organizationContactId: userInfo.organizationContactId,
				employeeId: userInfo.employeeId,
				metaData:
					this.configs && this.configs.db === 'sqlite' ? JSON.stringify(activityMetadata) : activityMetadata
			};
		});

		const allActivities = [...awActivities, ...wakatimeHeartbeats, ...this._activities];
		return { allActivities, idsAw, idsWakatime, durationAfk };
	}

	afkCount(afkList) {
		let afkTime: number = 0;

		const afkOnly = afkList.filter((afk) => {
			const jsonData = JSON.parse(afk.data);
			if (jsonData.status === 'afk') {
				return afk;
			}
		});
		console.log('afk list', afkOnly);
		afkOnly.forEach((x) => {
			afkTime += x.duration;
		});
		return afkTime;
	}

	async takeScreenshotActivities(timeTrackerWindow, lastTimeSlot, dataCollection) {
		const now = moment();
		const userInfo = LocalStore.beforeRequestParams();
		const projectInfo = LocalStore.getStore('project');
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');
		log.info(`App Setting: ${moment().format()}`, appSetting);
		log.info(`Config: ${moment().format()}`, config);
		const updatePeriod = parseInt(appSetting.timer.updatePeriod, 10) * 60;
		const timeLogId = this.lastTimer ? this.lastTimer.timelogId : null;
		const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
		const durationNow = now.diff(moment(lastTimeSlot), 'seconds');
		let durationNonAfk = durationNow - dataCollection.durationAfk;
		if (!projectInfo.aw.isAw || !appSetting.awIsConnected || dataCollection.allActivities.length === 0) {
			durationNonAfk = 0;
		}
		// Check api connectivity before to take a screenshot
		await this._offlineMode.connectivity();
		switch (appSetting.SCREENSHOTS_ENGINE_METHOD || config.SCREENSHOTS_ENGINE_METHOD) {
			case 'ElectronDesktopCapturer':
				timeTrackerWindow.webContents.send('prepare_activities_screenshot', {
					screenSize: screen.getPrimaryDisplay().workAreaSize,
					type: 'ElectronDesktopCapturer',
					displays: null,
					start: lastTimeSlot.utc().format(),
					end: moment().utc().format(),
					tpURL: projectInfo.aw.host,
					tp: 'aw',
					taskId: userInfo.taskId,
					organizationId: userInfo.organizationId,
					projectId: userInfo.projectId,
					organizationContactId: userInfo.organizationContactId,
					timeUpdatePeriod: appSetting.timer.updatePeriod,
					employeeId: userInfo.employeeId,
					...userInfo,
					timerId: lastTimerId,
					timeLogId: timeLogId,
					startedAt: lastTimeSlot.utc().toDate(),
					activities: dataCollection.allActivities,
					idsAw: dataCollection.idsAw,
					idsWakatime: dataCollection.idsWakatime,
					duration: durationNow,
					durationNonAfk: durationNonAfk < 0 ? 0 : durationNonAfk,
					activeWindow: detectActiveWindow(),
					isAw: projectInfo.aw.isAw,
					isAwConnected: appSetting.awIsConnected,
					keyboard: Math.round(this._eventCounter.keyboardPercentage * durationNow),
					mouse: Math.round(this._eventCounter.mousePercentage * durationNow),
					system: Math.round(this._eventCounter.systemPercentage * durationNow)
				});
				break;
			case 'ScreenshotDesktopLib':
				const displays = await getScreenshot();
				timeTrackerWindow.webContents.send('prepare_activities_screenshot', {
					screenSize: screen.getPrimaryDisplay().workAreaSize,
					type: 'ScreenshotDesktopLib',
					displays,
					start: lastTimeSlot.utc().format(),
					end: moment().utc().format(),
					tpURL: projectInfo.aw.host,
					tp: 'aw',
					taskId: userInfo.taskId,
					organizationId: userInfo.organizationId,
					projectId: userInfo.projectId,
					organizationContactId: userInfo.organizationContactId,
					employeeId: userInfo.employeeId,
					timeUpdatePeriod: appSetting.timer.updatePeriod,
					...userInfo,
					timerId: lastTimerId,
					timeLogId: timeLogId,
					startedAt: lastTimeSlot.utc().toDate(),
					activities: dataCollection.allActivities,
					idsAw: dataCollection.idsAw,
					idsWakatime: dataCollection.idsWakatime,
					duration: durationNow,
					durationNonAfk: durationNonAfk < 0 ? 0 : durationNonAfk,
					activeWindow: null,
					isAw: projectInfo.aw.isAw,
					isAwConnected: appSetting.awIsConnected,
					keyboard: Math.round(this._eventCounter.keyboardPercentage * durationNow),
					mouse: Math.round(this._eventCounter.mousePercentage * durationNow),
					system: Math.round(this._eventCounter.systemPercentage * durationNow)
				});
				break;
			default:
				break;
		}

		if (this._eventCounter.intervalDuration >= updatePeriod) {
			this._eventCounter.reset();
			this._activities = [];
		}
	}

	async stopTimer(setupWindow, timeTrackerWindow, knex, quitApp) {
		const appSetting = LocalStore.getStore('appSetting');
		appSetting.timerStarted = false;
		LocalStore.updateApplicationSetting(appSetting);
		this.notificationDesktop.timerActionNotification(false);
		/*
		 * Stop time interval after stop timer
		 */
		await this.stopTimerIntervalPeriod();
		const lastTimer = await TimerData.getLastTimer(knex, null);
		timeTrackerWindow.webContents.send('toggle_timer_state', {
			isStarted: false,
			lastTimer: lastTimer
		})
		this.updateToggle(setupWindow, knex, true);
		this.isPaused = true;
	}

	async createTimer(knex, timeLog) {
		try {
			const project = LocalStore.getStore('project');
			const info = LocalStore.beforeRequestParams();
			const payload = {
				projectId: project.projectId,
				employeeId: info.employeeId,
				timesheetId: timeLog ? timeLog.timesheetId : null,
				timelogId: timeLog ? timeLog.id : null
			};
			this.isPaused
				? await TimerData.createTimer(knex, {
					...payload,
					day: this.todayLocalTimezone,
					duration: 0,
					synced: !this._offlineMode.enabled,
					isStartedOffline: this._offlineMode.enabled,
					isStoppedOffline: false,
					version: 'v' + app.getVersion()
				})
				: await TimerData.updateDurationOfTimer(knex, {
					...payload,
					id: this.lastTimer.id,
				});

			const lastSavedTimer = await TimerData.getLastTimer(knex, info);

			if (lastSavedTimer) {
				this.lastTimer = lastSavedTimer;
			}

			this.isPaused = false;
		} catch (error) {
			console.log('Error create timer', error);
		}
	}

	/* Returning the current date and time in the local timezone. */
	public get todayLocalTimezone() {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		return date;
	}

	/*
	 * Make screenshots and activities after start and stop timer
	 */
	async makeScreenshot(setupWindow, knex, timeTrackerWindow, quitApp) {
		console.log(`Time Slot Start/End At ${quitApp ? 'End' : 'Beginning'}`, this.timeSlotStart);
		if (this.timeSlotStart) {
			await this.getSetActivity(knex, setupWindow, this.timeSlotStart, timeTrackerWindow, quitApp);
		}
	}

	async createQueue(type, data, knex) {
		const queName = `${type}-${this.appName}`;
		if (!this.queue) {
			this.queue = await EmbeddedQueue.Queue.createQueue({
				inMemoryOnly: true
			});
		}

		if (!this.queueType[queName]) {
			this.queueType[queName] = this.queue;
			this.queue.process(
				queName,
				async (job) => {
					await new Promise(async (resolve) => {
						const typeJob = job.data.type;
						try {
							switch (typeJob) {
								case 'window-events':
									await TimerData.insertWindowEvent(knex, job.data.data);
									break;
								case 'remove-window-events':
									await TimerData.deleteWindowEventAfterSended(knex, {
										activityIds: job.data.data
									});
									break;
								case 'remove-wakatime-events':
									await metaData.removeActivity(knex, {
										idsWakatime: job.data.data
									});
									break;
								case 'update-duration-timer':
									await TimerData.updateDurationOfTimer(knex, {
										id: job.data.data.id,
										duration: job.data.data.duration,
										...(this._offlineMode.enabled && { synced: false })
									});
									break;
								case 'save-failed-request':
									await TimerData.saveFailedRequest(knex, job.data.data);
									break;
								case 'update-timer-time-slot':
									await TimerData.updateTimerUpload(knex, {
										id: job.data.data.id,
										timeslotId: job.data.data.timeSlotId,
										timesheetId: job.data.data.timeSheetId
									});
									break;
								default:
									break;
							}
							resolve(true);
						} catch (error) {
							console.log('failed insert window activity');
							resolve(false);
						}
					});
				},
				1
			);

			// handle job complete event
			this.queue.on(EmbeddedQueue.Event.Complete, (job, result) => {
				job.remove();
			});
		}

		// create "adder" type job
		await this.queue.createJob({
			type: queName,
			data: data
		});
	}
}
