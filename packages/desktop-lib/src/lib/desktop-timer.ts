import { ActivityType, IActivityWatchCollectEventData, ITimeLog, TimeLogSourceEnum } from '@gauzy/contracts';
import { app, screen } from 'electron';
import * as  moment from 'moment';
import { DesktopActiveWindow } from './desktop-active-window';
import { DesktopEventCounter } from './desktop-event-counter';
import NotificationDesktop from './desktop-notifier';
import { detectActiveWindow, getScreenshot } from './desktop-screenshot';
import { LocalStore } from './desktop-store';
import { metaData } from './desktop-wakatime';
import {
	ActivityWatchAfkService,
	ActivityWatchChromeService,
	ActivityWatchEdgeService,
	ActivityWatchEventManager,
	ActivityWatchEventTableList,
	ActivityWatchFirefoxService,
	ActivityWatchService,
	ActivityWatchWindowService
} from './integrations';
import { IOfflineMode } from './interfaces';
import { DesktopOfflineModeHandler, Timer, TimerService, UserService } from './offline';

import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

const EmbeddedQueue = require('embedded-queue');

export default class TimerHandler {
	// How frequently to collect activities (ms)
	activitiesCollectionPeriod = 1000;
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
	appName = app.getName();
	_eventCounter = new DesktopEventCounter();

	private _activeWindow = new DesktopActiveWindow();
	private _activities = [];
	private _offlineMode: IOfflineMode = DesktopOfflineModeHandler.instance;
	private _timerService = new TimerService();
	private _randomSyncPeriod: number = 1;
	private readonly _activityWatchService: ActivityWatchService;
	private readonly _userService: UserService;

	constructor() {
		/**
		 * Handle windows change
		 */
		this._activeWindow.on('updated', async (win) => {
			try {
				this._activities.push({ ...win });
			} catch (e) {
				console.error('Error on handle window', e);
			}
		});

		this._activityWatchService = new ActivityWatchService();
		this._userService = new UserService();
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

		await this.createTimer(timeLog);

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
			lastTimer
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

				await this.processWithQueue(
					`gauzy-queue`,
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
		}, this.activitiesCollectionPeriod);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordSecond = now.diff(moment(this.timeStart), 'seconds');
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	async randomScreenshotUpdate(knex, timeTrackerWindow) {
		try {
			await this._activeWindow.updateActivities();
			console.log('Last Timer Id:', this.lastTimer ? this.lastTimer.id : null);
			const activities = await this.getAllActivities(knex, this.timeSlotStart);
			timeTrackerWindow.webContents.send('prepare_activities_screenshot', activities);
			this.nextTickScreenshot();
			console.log('Timeslot Start Time', this.timeSlotStart);
			this.timeSlotStart = moment();
		} catch (err) {
			console.error('Error on randomScreenshotUpdate', err);
		}
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
				startedAt: this.timeSlotStart.utc().toDate(),
				synced: !this._offlineMode.enabled,
				isStartedOffline: this._offlineMode.enabled
			})
		);

		this.intervalUpdateTime = setInterval(async () => {
			try {
				console.log('Start Timer Interval Period');
				await this._activeWindow.updateActivities();
				console.log('Last Timer Id:', this.lastTimer ? this.lastTimer.id : null);
				const activities = await this.getAllActivities(knex, this.timeSlotStart);
				console.log('Activities loaded');
				timeTrackerWindow.webContents.send('prepare_activities_screenshot', activities);
				console.log('Timeslot Start Time', this.timeSlotStart);
				this.timeSlotStart = moment();
			} catch (error) {
				console.error('Error on startTimerIntervalPeriod', error);
			}
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

			if (this._activeWindow?.active) await this._activeWindow.stop();

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
			console.error('Error on clear all intervals for timer', error);
		}

		console.log('Stop Timer Interval Period:', this.timeSlotStart, this.intervalTimer, this.intervalUpdateTime);
	}

	updateToggle(setupWindow, knex, isStop) {
		console.log('Update Toggle Timer');
		const params: any = {
			...LocalStore.beforeRequestParams()
		};

		if (isStop) params.manualTimeSlot = true;

		console.log('Update Toggle Timer End');
	}

	/*
	Get AW activities
	*/
	async getAllActivities(knex, lastTimeSlot) {
		try {
			console.log('Get All Activities Start for:', lastTimeSlot);
			const dataCollection = await this.activitiesCollection(knex, lastTimeSlot);
			console.log('Get All Activities End for:', lastTimeSlot);
			const result = await this.takeScreenshotActivities(lastTimeSlot, dataCollection);
			console.log('Get All Activities Result');
			return result;
		} catch (error) {
			console.error('Get AW activity Error', error);
		}
	}

	async activitiesCollection(knex, lastTimeSlot) {
		try {
			console.log('Activities Collection Start:', lastTimeSlot);
			const params = LocalStore.beforeRequestParams();
			const appSetting = LocalStore.getStore('appSetting');
			const config = LocalStore.getStore('configs');

			log.info(`App Setting: ${moment().format()}`, appSetting);
			log.info(`Config: ${moment().format()}`, config);

			const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
			const awActivities = await this._activityWatchService.activities(lastTimerId);

			// get Wakatime heartbeats
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

			// formatting Wakatime
			wakatimeHeartbeats = wakatimeHeartbeats.map((item) => {
				idsWakatime.push(item.id);

				const activityMetadata = {
					type: item.type,
					dependencies: item.dependencies,
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
						this.configs &&
						(this.configs.db === 'sqlite' ||
							this.configs.db === 'better-sqlite' ||
							this.configs.db === 'better-sqlite3')
							? JSON.stringify(activityMetadata)
							: activityMetadata
				};
			});

			const allActivities = [...awActivities, ...wakatimeHeartbeats];

			if (!this._activityWatchService.isConnected) {
				allActivities.push(...this._activities);
			}

			console.log('Activities Collection End. Count:', allActivities.length);

			return { allActivities, idsWakatime };
		} catch (error) {
			console.error('Error on activitiesCollection', error);
			return null;
		}
	}

	async takeScreenshotActivities(lastTimeSlot, dataCollection) {
		console.log('Take Screenshot Activities Start:', lastTimeSlot);

		const now = moment();
		const nowUtcFormat = now.utc().format();
		const start = lastTimeSlot.utc().format();
		const startedAt = now.utc().toDate();
		const params = LocalStore.beforeRequestParams();
		const projectInfo = LocalStore.getStore('project');
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');

		log.info(`App Setting: ${now.format()}`, appSetting);
		log.info(`Config: ${now.format()}`, config);

		const updatePeriod =
			parseInt(appSetting.randomScreenshotTime ? this._randomSyncPeriod : appSetting.timer.updatePeriod, 10) * 60;
		console.log('Update Period:', updatePeriod);

		const timeLogId = this.lastTimer ? this.lastTimer.timelogId : null;
		console.log('Time Log Id', timeLogId);

		const lastTimerId = this.lastTimer ? this.lastTimer.id : null;
		console.log('Last Timer Id', lastTimerId);

		const durationNow = now.diff(moment(lastTimeSlot), 'seconds');
		console.log('Duration Now:', durationNow);

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
				console.log('ElectronDesktopCapturer');
				preparedActivities = {
					screenSize: screen?.getPrimaryDisplay()?.workAreaSize,
					type: 'ElectronDesktopCapturer',
					displays: null,
					start: start,
					end: nowUtcFormat,
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
					startedAt: startedAt,
					activities: dataCollection?.allActivities,
					idsAw: dataCollection?.idsAw,
					idsWakatime: dataCollection?.idsWakatime,
					duration: durationNow,
					activeWindow: detectActiveWindow(),
					isAw: projectInfo.aw.isAw,
					isAwConnected: appSetting.awIsConnected,
					...activityPercentages
				};
				break;

			case 'ScreenshotDesktopLib':
				console.log('ScreenshotDesktopLib');
				const displays = await getScreenshot();

				preparedActivities = {
					screenSize: screen?.getPrimaryDisplay()?.workAreaSize,
					type: 'ScreenshotDesktopLib',
					displays,
					start: start,
					end: nowUtcFormat,
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
					startedAt: startedAt,
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
				console.log('SCREENSHOTS_ENGINE_METHOD is not set');
				break;
		}

		if (this._eventCounter.intervalDuration >= updatePeriod) {
			console.log('Resetting Event Counter');
			this._eventCounter.reset();
			console.log('Event Counter Reset');

			await this._activityWatchService.clearAllEvents();
			console.log('Cleared All Events');

			this._activities = [];
		}

		return preparedActivities;
	}

	async stopTimer(setupWindow, timeTrackerWindow, knex, quitApp) {
		console.log('TimerHandler -> Stop Timer');

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

	public async createTimer(timeLog: ITimeLog): Promise<void> {
		console.log('Create Timer');

		try {
			const project = LocalStore.getStore('project');

			const user = await this._userService.retrieve();

			const payload = {
				projectId: project?.projectId,
				employeeId: user.employeeId,
				timesheetId: timeLog?.timesheetId ?? null,
				timelogId: timeLog?.id ?? null,
				organizationTeamId: project?.organizationTeamId,
				taskId: project?.taskId,
				description: project?.note
			};

			if (this.isPaused) {
				console.log('Create Timer - Paused');
				await this._timerService.save(
					new Timer({
						...payload,
						day: this.todayLocalTimezone,
						duration: 0,
						synced: !this._offlineMode.enabled,
						isStartedOffline: this._offlineMode.enabled,
						isStoppedOffline: false,
						version: 'v' + app.getVersion()
					})
				);
			} else {
				console.log('Create Timer - Not Paused');
				await this._timerService.update(
					new Timer({
						...payload,
						id: this.lastTimer.id
					})
				);
			}

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
	 * Collect All activities after start and stop timer
	 */
	async collectAllActivities(knex, quitApp) {
		console.log(`Time Slot Start/End At ${quitApp ? 'End' : 'Beginning'}`, this.timeSlotStart);

		if (this.timeSlotStart) {
			console.log('Collection Started At: ', this.timeSlotStart);
			await this._activeWindow.updateActivities();
			console.log('Updated Activities');

			const activities = await this.getAllActivities(knex, this.timeSlotStart);

			console.log('Collection Ended At: ', this.timeSlotStart);

			return activities;
		} else {
			console.log('Time Slot Start is not set');
			return null;
		}
	}

	private async ProcessQueueMessage(job, knex) {
		await new Promise(async (resolve) => {
			const windowService = new ActivityWatchWindowService();

			const typeJob = job.data.type;

			try {
				switch (typeJob) {
					case ActivityWatchEventTableList.WINDOW:
						{
							console.log('Processing Window Event');
							await windowService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.AFK:
						{
							console.log('Processing AFK Event');
							const afkService = new ActivityWatchAfkService();
							await afkService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.CHROME:
						{
							console.log('Processing Chrome Event');
							const chromeService = new ActivityWatchChromeService();
							await chromeService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.FIREFOX:
						{
							console.log('Processing Firefox Event');
							const firefoxService = new ActivityWatchFirefoxService();
							await firefoxService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.EDGE:
						{
							console.log('Processing Edge Event');
							const edgeService = new ActivityWatchEdgeService();
							await edgeService.save(job.data.data);
						}
						break;

					case 'remove-window-events':
						console.log('Removing Window Events');
						await windowService.clear();
						break;

					case 'remove-wakatime-events':
						console.log('Removing Wakatime Events');
						await metaData.removeActivity(knex, {
							idsWakatime: job.data.data
						});
						break;

					case 'update-duration-timer':
						const pUpdate = {
							id: job.data.data.id,
							duration: job.data.data.duration,
							...(this._offlineMode.enabled && { synced: false })
						};

						console.log(
							`Updating Timer Duration ${JSON.stringify(pUpdate)} - Offline Mode: ${
								this._offlineMode.enabled
							}`
						);

						await this._timerService.update(new Timer(pUpdate));

						break;

					case 'update-timer-time-slot':
						const pUpdateSlot = {
							id: job.data.data.id,
							timeslotId: job.data.data.timeSlotId,
							timesheetId: job.data.data.timeSheetId
						};

						console.log(`Updating Timer Time Slot ${JSON.stringify(pUpdateSlot)}`);

						await this._timerService.update(new Timer(pUpdateSlot));

						break;

					default:
						console.log('Unknown Job Type');
						break;
				}

				resolve(true);
			} catch (error) {
				console.error('failed insert window activity', error);
				resolve(false);
			}
		});
	}

	async processWithQueue(type, data, knex) {
		const queName = `${type}-${this.appName}`;
		console.log(`processWithQueue Called for ${queName}`);

		if (!this.queue) {
			console.log(`Initializing Queue ${queName}`);

			this.queue = await EmbeddedQueue.Queue.createQueue({
				inMemoryOnly: true
			});

			console.log(`Queue initialized ${queName}`);

			this.queue.process(
				queName,
				async (job) => {
					console.log(`Processing Job for ${queName}`);
					await this.ProcessQueueMessage(job, knex);
				},
				// concurrency is 1
				1
			);

			// handle job complete event
			this.queue.on(EmbeddedQueue.Event.Complete, (job, result) => {
				console.log(`Removing Job from Queue ${queName}`);
				job.remove();
			});
		}

		// create job and add to queue
		await this.queue.createJob({
			type: queName,
			data: data
		});

		console.log(`Job Created for ${queName}`);
	}
}
