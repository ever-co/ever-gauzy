import {
	ActivityType,
	IActivityWatchCollectEventData,
	ITimeLog,
	TimeLogSourceEnum,
	TimerSyncStateEnum,
	TimerActionTypeEnum
} from '@gauzy/contracts';
import { app, screen } from 'electron';
import * as moment from 'moment';
import { DesktopActiveWindow } from './desktop-active-window';
import { DesktopEventCounter } from '@gauzy/desktop-activity';
import NotificationDesktop from './desktop-notifier';
import { detectActiveWindow, getScreenshot } from './desktop-screenshot';
import { LocalStore } from './desktop-store';
import { metaData } from './desktop-wakatime';
import { ActivityWatchEventManager, ActivityWatchService } from './integrations';
import { IOfflineMode } from './interfaces';
import { DesktopOfflineModeHandler, Timer, TimerService, UserService } from './offline';
import { logger } from '@gauzy/desktop-core';
import { AuditLogHandler } from './audit';
import { AsyncTimerSyncQueue, IAsyncTimerSyncQueueOptions, isAsyncTimerDataSyncEnabled } from './queues/async-timer-sync-queue';
import { ITimerQueueJob, TimerQueueProcessor } from './queues/timer-queue-processor';

// embedded-queue is required lazily inside processWithQueue() to avoid
// loading it at module import time (before app.ready).

/** How long building a time slot waits for the activity saves queued before it (asynchronous sync only). */
const ACTIVITY_SETTLE_MS = 5_000;
/** How long a job that could not be stored waits for the stored jobs ahead of it before running in memory. */
const FALLBACK_SETTLE_MS = 5_000;
/** How long quitting waits for the stored jobs to be applied, then for the running one; the rest runs on the next start. */
const QUIT_SETTLE_MS = 3_000;
const QUIT_CLOSE_MS = 1_000;

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
	// Deferred: app.getName() is unsafe before app.ready — resolved on first access
	private _appName: string | null = null;
	get appName(): string {
		if (!this._appName) this._appName = app.getName();
		return this._appName;
	}
	_eventCounter = new DesktopEventCounter();

	private _activeWindow = new DesktopActiveWindow();
	private _activities = [];
	private _offlineMode: IOfflineMode = DesktopOfflineModeHandler.instance;
	private _timerService = new TimerService();
	// Applies queue jobs to the local database, for the in-memory queue and the persistent one alike.
	private readonly _queueProcessor = new TimerQueueProcessor(this._timerService, this._offlineMode);
	// Persistent queue of the asynchronous timer data sync (`appSetting.asyncTimerDataSync`, off by default), or null
	// for the in-memory queue. Decided once, on the first job, so a session never mixes the two queues: a change of
	// the setting applies from the next start.
	private _asyncTimerSync: Promise<AsyncTimerSyncQueue | null> | null = null;
	// The setting is off but an earlier asynchronous session left jobs behind: new jobs queue behind them until none is
	// left, then the session moves to the in-memory queue.
	private _drainingLeftovers = false;
	private _randomSyncPeriod: number = 1;
	private readonly _activityWatchService: ActivityWatchService;
	private readonly _userService: UserService;
	private readonly _auditLogHandler: AuditLogHandler;

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
		this._auditLogHandler = AuditLogHandler.getInstance();
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
			await this._auditLogHandler.timerAuditInfo(
				`[collectActivities] Stamping startedAt on local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) before starting random-screenshot activity collection`
			);
			await this._timerService.update(
				new Timer({
					id: this.lastTimer ? this.lastTimer.id : null,
					startedAt: new Date(),
					synced: !this._offlineMode.enabled,
					isStartedOffline: this._offlineMode.enabled
				})
			);
			await this._auditLogHandler.timerAuditInfo(
				`[collectActivities] Local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) startedAt stamped — random-screenshot collection interval ready`
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

		await this._auditLogHandler.timerAuditInfo(
			`[startTimerIntervalPeriod] Anchoring time-slot start on local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) — startedAt: ${this.timeSlotStart.utc().toISOString()}, offlineMode: ${this._offlineMode.enabled}`
		);
		await this._timerService.update(
			new Timer({
				id: this.lastTimer ? this.lastTimer.id : null,
				startedAt: this.timeSlotStart.utc().toDate(),
				synced: !this._offlineMode.enabled,
				isStartedOffline: this._offlineMode.enabled
			})
		);
		await this._auditLogHandler.timerAuditInfo(
			`[startTimerIntervalPeriod] Local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) time-slot start anchored — periodic screenshot/activity interval starting every ${updatePeriod} min`
		);

		this.intervalUpdateTime = setInterval(
			async () => {
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
					await this._auditLogHandler.timerAuditError(
						`[startTimerIntervalPeriod] Failed to collect activities/screenshot for timer (id: ${this.lastTimer ? this.lastTimer.id : null}): ${error?.message ?? error}`
					);
				}
			},
			60 * 1000 * updatePeriod
		);
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

			await this._auditLogHandler.timerAuditInfo(
				`[stopTimerIntervalPeriod] Stamping stoppedAt on local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) — offlineMode: ${this._offlineMode.enabled}, stopSyncState: PENDING`
			);
			await this._timerService.update(
				new Timer({
					id: this.lastTimer ? this.lastTimer.id : null,
					stoppedAt: new Date(),
					synced: !this._offlineMode.enabled,
					isStoppedOffline: this._offlineMode.enabled,
					stopSyncState: TimerSyncStateEnum.PENDING
				})
			);
			await this._auditLogHandler.timerAuditInfo(
				`[stopTimerIntervalPeriod] Local timer (id: ${this.lastTimer ? this.lastTimer.id : null}) stoppedAt stamped — all intervals cleared, sync queued`
			);
		} catch (error) {
			await this._auditLogHandler.timerAuditError(
				`[stopTimerIntervalPeriod] Failed to stamp stoppedAt on local timer (id: ${this.lastTimer ? this.lastTimer.id : null}): ${error?.message ?? error}`
			);
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
			// Activity saved before this slot is still queued (asynchronous sync): read the tables once it is written,
			// or it would miss this slot and, saved after the reset below, land in the next one.
			if (!(await this.settleTimerJobs(knex, ACTIVITY_SETTLE_MS))) {
				await this._auditLogHandler.timerAuditError(
					`[getAllActivities] Activity queued before this time slot was not written within ${ACTIVITY_SETTLE_MS} ms`
				);
			}
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

			logger.info(`App Setting: ${moment().format()}`, appSetting);
			logger.info(`Config: ${moment().format()}`, config);

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

		logger.info(`App Setting: ${now.format()}`, appSetting);
		logger.info(`Config: ${now.format()}`, config);

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
					activities: dataCollection?.allActivities,
					idsAw: dataCollection?.idsAw,
					idsWakatime: dataCollection?.idsWakatime,
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

		if (quitApp) {
			await this.closeAsyncTimerSync().catch((error) => console.error('Error releasing the timer queue', error));
		}

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
				await this._auditLogHandler.timerAuditInfo(
					`[createTimer] Saving new local timer record — offlineMode: ${this._offlineMode.enabled}, startSyncState: PENDING, version: v${app.getVersion()}`
				);
				await this._timerService.save(
					new Timer({
						...payload,
						day: this.todayLocalTimezone,
						duration: 0,
						synced: !this._offlineMode.enabled,
						isStartedOffline: this._offlineMode.enabled,
						isStoppedOffline: false,
						version: 'v' + app.getVersion(),
						startSyncState: TimerSyncStateEnum.PENDING
					})
				);
				await this._auditLogHandler.timerAuditInfo(
					`[createTimer] New local timer record saved successfully`
				);
			} else {
				await this._auditLogHandler.timerAuditInfo(
					`[createTimer] Timer already running — updating existing local timer (id: ${this.lastTimer.id}) with latest project/task payload`
				);
				await this._timerService.update(
					new Timer({
						...payload,
						id: this.lastTimer.id
					})
				);
				await this._auditLogHandler.timerAuditInfo(
					`[createTimer] Existing local timer (id: ${this.lastTimer.id}) updated with latest project/task payload`
				);
			}

			const lastSavedTimer = await this._timerService.findLastOne();

			if (lastSavedTimer) {
				this.lastTimer = lastSavedTimer;
			}

			this.isPaused = false;
		} catch (error) {
			await this._auditLogHandler.timerAuditError(
				`[createTimer] Failed to save/update local timer — ${error?.message ?? error}`
			);
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
		try {
			await this._queueProcessor.process(job.data, knex);
		} catch (error) {
			await this.auditQueueJobFailure(job?.data, error);
		}
	}

	private async auditQueueJobFailure(job: ITimerQueueJob, error) {
		await this._auditLogHandler.timerAuditError(
			`[ProcessQueueMessage] Failed to process queue job (type: ${job?.type}): ${error?.message ?? error}`
		);
	}

	/*
	 * The persistent queue when `appSetting.asyncTimerDataSync` is on, otherwise null (the in-memory queue).
	 * With the setting off, jobs an earlier asynchronous session left behind keep running, ahead of new jobs, until
	 * none is left, so turning it off loses nothing and reorders nothing; without that session's file this is a no-op.
	 * If the persistent queue cannot be opened, or once it is closed, the in-memory queue is used.
	 */
	private async asyncTimerSync(knex): Promise<AsyncTimerSyncQueue | null> {
		this._asyncTimerSync ??= this.openAsyncTimerSync(knex);
		const queue = await this._asyncTimerSync;
		if (!queue || queue.isClosed) {
			return null;
		}
		if (this._drainingLeftovers && this.isIdle(queue)) {
			this._drainingLeftovers = false;
			this._asyncTimerSync = Promise.resolve(null);
			await queue.close();
			return null;
		}
		return queue;
	}

	/* A store that cannot be read counts as busy: jobs keep going to the persistent queue, or fall back from there. */
	private isIdle(queue: AsyncTimerSyncQueue): boolean {
		try {
			return queue.isIdle();
		} catch {
			return false;
		}
	}

	/*
	 * Resolves once the timer jobs queued so far have been applied to the local database (false after `timeoutMs`).
	 * Always true with the in-memory queue, which is not waited for, as before.
	 */
	private async settleTimerJobs(knex, timeoutMs: number): Promise<boolean> {
		const queue = await this.asyncTimerSync(knex);
		return queue ? queue.settle(timeoutMs).catch(() => false) : true;
	}

	/*
	 * When the app quits: applies what the persistent queue holds (bounded) and releases it; the rest runs on the next
	 * start, and the jobs that still come (e.g. the last time-slot link) use the in-memory queue.
	 */
	private async closeAsyncTimerSync(): Promise<void> {
		const queue = await this._asyncTimerSync;
		if (!queue || queue.isClosed) {
			return;
		}
		try {
			await queue.settle(QUIT_SETTLE_MS);
		} finally {
			this._drainingLeftovers = false;
			this._asyncTimerSync = Promise.resolve(null);
			await queue.close(QUIT_CLOSE_MS).catch((error) => console.error('Error closing the timer queue', error));
		}
	}

	private async openAsyncTimerSync(knex): Promise<AsyncTimerSyncQueue | null> {
		const options: IAsyncTimerSyncQueueOptions = {
			processor: this._queueProcessor,
			offlineMode: this._offlineMode,
			onJobFailed: (job, error) => this.auditQueueJobFailure(job, error)
		};
		try {
			if (isAsyncTimerDataSyncEnabled(LocalStore.getStore('appSetting'))) {
				return new AsyncTimerSyncQueue(options).open(knex);
			}
			const leftovers = AsyncTimerSyncQueue.openLeftovers(knex, options);
			this._drainingLeftovers = leftovers !== null;
			return leftovers;
		} catch (error) {
			await this._auditLogHandler.timerAuditError(
				`[processWithQueue] Persistent timer queue unavailable, using the in-memory queue: ${error?.message ?? error}`
			);
		}
		return null;
	}

	async processWithQueue(type, data, knex) {
		const asyncTimerSync = await this.asyncTimerSync(knex);

		if (asyncTimerSync) {
			try {
				return await asyncTimerSync.processWithQueue(type, data, knex);
			} catch (error) {
				// The job was not stored: run it on the in-memory queue below rather than lose it — once the stored jobs
				// ahead of it have run, so it does not overtake them. A closed queue (quitting) needs neither.
				if (!asyncTimerSync.isClosed) {
					await this._auditLogHandler.timerAuditError(
						`[processWithQueue] Could not store queue job (type: ${data?.type}), processing it in memory: ${error?.message ?? error}`
					);
					await asyncTimerSync.settle(FALLBACK_SETTLE_MS).catch(() => false);
				}
			}
		}

		const queName = `${type}-${this.appName}`;
		console.log(`processWithQueue Called for ${queName}`);

		if (!this.queue) {
			console.log(`Initializing Queue ${queName}`);

			// Lazy require — deferred from module scope to avoid loading embedded-queue
			// (and its native dependencies) before app.ready.
			const EmbeddedQueue = require('embedded-queue');

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

	async updateTimerSyncState(
		type: TimerActionTypeEnum,
		data: {
			state: TimerSyncStateEnum;
			duration: number;
			timerId: number;
			timelogId?: string;
		}
	) {
		const lastTimer = await this._timerService.findById({ id: data.timerId });
		if (!lastTimer) {
			await this._auditLogHandler.timerAuditError(
				`[updateTimerSyncState] Cannot update sync state — local timer with id ${data.timerId} not found`
			);
			return;
		}
		const syncStateField = type === 'startTimer' ? 'startSyncState' : 'stopSyncState';
		await this._auditLogHandler.timerAuditInfo(
			`[updateTimerSyncState] Setting ${syncStateField} to '${data.state}' on local timer (id: ${data.timerId})${
				data.duration ? `, syncDuration: ${data.duration}ms` : ''
			} — action: ${type}`
		);
		await this._timerService.update(
			new Timer({
				...lastTimer,
				...(type === 'startTimer' ? { startSyncState: data.state } : { stopSyncState: data.state }),
				...(data.duration ? { syncDuration: data.duration } : {}),
				...(typeof data.timelogId !== 'undefined' ? { timelogId: data.timelogId } : {})
			})
		);
		await this._auditLogHandler.timerAuditInfo(
			`[updateTimerSyncState] Local timer (id: ${data.timerId}) ${syncStateField} updated to '${data.state}'`
		);
	}
}
