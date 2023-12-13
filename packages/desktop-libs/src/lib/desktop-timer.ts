import moment from 'moment';
import { app, screen } from 'electron';
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
import { IActivityWatchCollectEventData } from '@gauzy/contracts';
import {
	ActivityWatchEventManager,
	ActivityWatchEventTableList,
	ActivityWatchService,
	ActivityWatchFirefoxService,
	ActivityWatchChromeService,
	ActivityWatchWindowService,
	ActivityWatchAfkService,
	ActivityWatchEdgeService
} from './integrations';

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
	private _randomSyncPeriod: number = 1;
	private readonly _activityWatchService: ActivityWatchService;

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
		this._activityWatchService = new ActivityWatchService();
	}

	async startTimer(setupWindow, knex, timeTrackerWindow, timeLog) {
		this._activities = [];
		await this._activityWatchService.clearAllEvents();
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
		await this.collectActivities(setupWindow, knex, timeTrackerWindow);

		/*
		 * Start time interval for get set activities and screenshots
		 */
		if (!appSetting.randomScreenshotTime) {
			await this.startTimerIntervalPeriod(setupWindow, knex, timeTrackerWindow);
		}

		const lastTimer = await this._timerService.findLastOne();
		return {
			isStarted: true,
			lastTimer: lastTimer
		};
	}

	/*
	 * Collect windows and afk activities
	 */
	async collectActivities(setupWindow, knex, timeTrackerWindow) {
		const appSetting = LocalStore.getStore('appSetting');
		let nextScreenShootLock = false;
		if (appSetting.randomScreenshotTime) {
			await this._timerService.update(
				new Timer({
					id: this.lastTimer ? this.lastTimer.id : null,
					startedAt: new Date(),
					synced: !this._offlineMode.enabled,
					isStartedOffline: this._offlineMode.enabled
				})
			);
		}
		this.intervalTimer = setInterval(async () => {
			try {
				const appSetting = LocalStore.getStore('appSetting');
				await this.createQueue(
					`sqlite-queue-${process.env.NAME}`,
					{
						type: 'update-duration-timer',
						data: {
							id: this.lastTimer ? this.lastTimer.id : null,
							duration: moment().diff(moment(this.timeStart), 'milliseconds')
						}
					},
					knex
				);
				if (this._activityWatchService.isConnected) {
					const end = moment().toDate();
					const start = moment(this.timeSlotStart).toDate();
					const data: IActivityWatchCollectEventData = {
						start,
						end,
						timerId: this.lastTimer?.id
					};
					ActivityWatchEventManager.collectActivities(data, timeTrackerWindow);
				}

				this.calculateTimeRecord();
				timeTrackerWindow.webContents.send('timer_push', {
					second: this.timeRecordSecond,
					minute: this.timeRecordMinute,
					hours: this.timeRecordHours
				});

				if (appSetting.randomScreenshotTime) {
					const elapsedTime = Math.floor(moment.duration(this.timeRecordSecond, 'second').asMinutes());
					if (this.nextScreenshot === elapsedTime && !nextScreenShootLock) {
						nextScreenShootLock = true;
						await this.randomScreenshotUpdate(knex, timeTrackerWindow);
						nextScreenShootLock = false;
					}
				}
			} catch (error) {
				console.error('error', error);
			}
		}, 1000);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordSecond = now.diff(moment(this.timeStart), 'seconds');
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	async randomScreenshotUpdate(knex, timeTrackerWindow) {
		await this._activeWindow.updateActivities();
		const activities = await this.getAllActivities(knex, this.timeSlotStart);
		timeTrackerWindow.webContents.send('prepare_activities_screenshot', activities);
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
			await this._activeWindow.updateActivities();
			console.log('Last Timer Id:', this.lastTimer ? this.lastTimer.id : null);
			const activities = await this.getAllActivities(knex, this.timeSlotStart);
			timeTrackerWindow.webContents.send('prepare_activities_screenshot', activities);
			console.log('Timeslot Start Time', this.timeSlotStart);
			this.timeSlotStart = moment();
		}, 60 * 1000 * updatePeriod);
	}

	nextTickScreenshot() {
		const appSetting = LocalStore.getStore('appSetting');
		const updatePeriod = appSetting.timer.updatePeriod;
		const tickAdd = this.maxMinAdditionalTime(updatePeriod);
		this._randomSyncPeriod = Math.floor(Math.random() * (tickAdd.max - tickAdd.min + 1)) + tickAdd.min;
		this.nextScreenshot += this._randomSyncPeriod;
	}

	maxMinAdditionalTime(updatePeriod: number) {
		// Calculate the minimum additional time with a random multiplier between 0 and 1, ensuring it's at least 1 unit of time.
		const minAdditionalTime = Math.max(1, Math.floor(updatePeriod * Math.random()));

		// Calculate the maximum additional time as a random value between minAdditionalTime and updatePeriod
		const maxAdditionalTime =
			Math.floor(Math.random() * (updatePeriod - minAdditionalTime + 1)) + minAdditionalTime;

		return {
			max: maxAdditionalTime,
			min: minAdditionalTime
		};
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

	async getAllActivities(knex, lastTimeSlot) {
		// get aw activity
		try {
			const dataCollection = await this.activitiesCollection(knex, lastTimeSlot);
			return await this.takeScreenshotActivities(lastTimeSlot, dataCollection);
		} catch (error) {
			console.log('Get AW activity Error', error);
		}
	}

	async activitiesCollection(knex, lastTimeSlot) {
		const params = LocalStore.beforeRequestParams();
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');

		log.info(`App Setting: ${moment().format()}`, appSetting);
		log.info(`Config: ${moment().format()}`, config);

		const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
		const awActivities = await this._activityWatchService.activities(lastTimerId);

		// get wakatime heartbeats
		let wakatimeHeartbeats = await metaData.getActivity(knex, {
			start: lastTimeSlot.utc().format('YYYY-MM-DD HH:mm:ss'),
			end: moment().utc().format('YYYY-MM-DD HH:mm:ss')
		});

		//calculate mouse and keyboard activity as per selected period
		const idsWakatime = [];

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
							taskId: params.taskId,
							projectId: params.projectId,
							organizationContactId: params.organizationContactId,
							organizationId: params.organizationId,
							employeeId: params.employeeId,
							source: TimeLogSourceEnum.DESKTOP,
							recordedAt: moment(item.timestamp).utc().toDate(),
							metaData: item.data
					  }
					: null;
			})
			.filter((item) => !!item);

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
				taskId: params.taskId,
				organizationId: params.organizationId,
				projectId: params.projectId,
				organizationContactId: params.organizationContactId,
				employeeId: params.employeeId,
				metaData:
					this.configs && this.configs.db === 'sqlite' ? JSON.stringify(activityMetadata) : activityMetadata
			};
		});

		const allActivities = [...awActivities, ...wakatimeHeartbeats];
		if (!this._activityWatchService.isConnected) {
			allActivities.push(...this._activities);
		}
		return { allActivities, idsWakatime };
	}

	async takeScreenshotActivities(lastTimeSlot, dataCollection) {
		const now = moment();
		const params = LocalStore.beforeRequestParams();
		const projectInfo = LocalStore.getStore('project');
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');
		log.info(`App Setting: ${moment().format()}`, appSetting);
		log.info(`Config: ${moment().format()}`, config);
		const updatePeriod =
			parseInt(appSetting.randomScreenshotTime ? this._randomSyncPeriod : appSetting.timer.updatePeriod, 10) * 60;
		const timeLogId = this.lastTimer ? this.lastTimer.timelogId : null;
		const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
		const durationNow = now.diff(moment(lastTimeSlot), 'seconds');
		const activityWatch = await this._activityWatchService.activityPercentage(lastTimerId);
		const activityPercentages = {
			keyboard: Math.round(
				(this._activityWatchService.isConnected
					? activityWatch.keyboardPercentage
					: this._eventCounter.keyboardPercentage) * durationNow
			),
			mouse: Math.round(
				(this._activityWatchService.isConnected
					? activityWatch.mousePercentage
					: this._eventCounter.mousePercentage) * durationNow
			),
			system: Math.round(
				(this._activityWatchService.isConnected
					? activityWatch.systemPercentage
					: this._eventCounter.systemPercentage) * durationNow
			)
		};
		let preparedActivities = null;
		// Check api connectivity before to take a screenshot
		await this._offlineMode.connectivity();
		switch (appSetting.SCREENSHOTS_ENGINE_METHOD || config.SCREENSHOTS_ENGINE_METHOD) {
			case 'ElectronDesktopCapturer':
				preparedActivities = {
					screenSize: screen.getPrimaryDisplay().workAreaSize,
					type: 'ElectronDesktopCapturer',
					displays: null,
					start: lastTimeSlot.utc().format(),
					end: moment().utc().format(),
					tpURL: projectInfo.aw.host,
					tp: 'aw',
					taskId: params.taskId,
					organizationId: params.organizationId,
					projectId: params.projectId,
					organizationContactId: params.organizationContactId,
					timeUpdatePeriod: updatePeriod,
					employeeId: params.employeeId,
					...params,
					timerId: lastTimerId,
					timeLogId: timeLogId,
					startedAt: lastTimeSlot.utc().toDate(),
					activities: dataCollection.allActivities,
					idsAw: dataCollection.idsAw,
					idsWakatime: dataCollection.idsWakatime,
					duration: durationNow,
					activeWindow: detectActiveWindow(),
					isAw: projectInfo.aw.isAw,
					isAwConnected: appSetting.awIsConnected,
					...activityPercentages
				};
				break;
			case 'ScreenshotDesktopLib':
				const displays = await getScreenshot();
				preparedActivities = {
					screenSize: screen.getPrimaryDisplay().workAreaSize,
					type: 'ScreenshotDesktopLib',
					displays,
					start: lastTimeSlot.utc().format(),
					end: moment().utc().format(),
					tpURL: projectInfo.aw.host,
					tp: 'aw',
					taskId: params.taskId,
					organizationId: params.organizationId,
					projectId: params.projectId,
					organizationContactId: params.organizationContactId,
					employeeId: params.employeeId,
					timeUpdatePeriod: updatePeriod,
					...params,
					timerId: lastTimerId,
					timeLogId: timeLogId,
					startedAt: lastTimeSlot.utc().toDate(),
					activities: dataCollection.allActivities,
					idsAw: dataCollection.idsAw,
					idsWakatime: dataCollection.idsWakatime,
					duration: durationNow,
					activeWindow: null,
					isAw: projectInfo.aw.isAw,
					isAwConnected: appSetting.awIsConnected,
					...activityPercentages
				};
				break;
			default:
				break;
		}

		if (this._eventCounter.intervalDuration >= updatePeriod) {
			this._eventCounter.reset();
			await this._activityWatchService.clearAllEvents();
			this._activities = [];
		}
		return preparedActivities;
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
		const lastTimer = await this._timerService.findLastOne();
		this.updateToggle(setupWindow, knex, true);
		this.isPaused = true;
		return {
			isStarted: false,
			lastTimer: lastTimer
		};
	}

	async createTimer(knex, timeLog) {
		try {
			const project = LocalStore.getStore('project');
			const params = LocalStore.beforeRequestParams();
			const payload = {
				projectId: project?.projectId,
				employeeId: params.employeeId,
				timesheetId: timeLog ? timeLog.timesheetId : null,
				timelogId: timeLog ? timeLog.id : null,
				organizationTeamId: project?.organizationTeamId,
				taskId: project?.taskId,
				description: project?.note
			};
			this.isPaused
				? await this._timerService.save(
						new Timer({
							...payload,
							day: this.todayLocalTimezone,
							duration: 0,
							synced: !this._offlineMode.enabled,
							isStartedOffline: this._offlineMode.enabled,
							isStoppedOffline: false,
							version: 'v' + app.getVersion()
						})
				  )
				: await this._timerService.update(
						new Timer({
							...payload,
							id: this.lastTimer.id
						})
				  );

			const lastSavedTimer = await this._timerService.findLastOne();

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
	async makeScreenshot(knex, quitApp) {
		console.log(`Time Slot Start/End At ${quitApp ? 'End' : 'Beginning'}`, this.timeSlotStart);
		if (this.timeSlotStart) {
			await this._activeWindow.updateActivities();
			return await this.getAllActivities(knex, this.timeSlotStart);
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
						const windowService = new ActivityWatchWindowService();
						const typeJob = job.data.type;
						try {
							switch (typeJob) {
								case ActivityWatchEventTableList.WINDOW:
									{
										await windowService.save(job.data.data);
									}
									break;
								case ActivityWatchEventTableList.AFK:
									{
										const afkService = new ActivityWatchAfkService();
										await afkService.save(job.data.data);
									}
									break;
								case ActivityWatchEventTableList.CHROME:
									{
										const chromeService = new ActivityWatchChromeService();
										await chromeService.save(job.data.data);
									}
									break;
								case ActivityWatchEventTableList.FIREFOX:
									{
										const firefoxService = new ActivityWatchFirefoxService();
										await firefoxService.save(job.data.data);
									}
									break;
								case ActivityWatchEventTableList.EDGE:
									{
										const edgeService = new ActivityWatchEdgeService();
										await edgeService.save(job.data.data);
									}
									break;
								case 'remove-window-events':
									await windowService.clear();
									break;
								case 'remove-wakatime-events':
									await metaData.removeActivity(knex, {
										idsWakatime: job.data.data
									});
									break;
								case 'update-duration-timer':
									await this._timerService.update(
										new Timer({
											id: job.data.data.id,
											duration: job.data.data.duration,
											...(this._offlineMode.enabled && { synced: false })
										})
									);
									break;
								case 'update-timer-time-slot':
									await this._timerService.update(
										new Timer({
											id: job.data.data.id,
											timeslotId: job.data.data.timeSlotId,
											timesheetId: job.data.data.timeSheetId
										})
									);
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
