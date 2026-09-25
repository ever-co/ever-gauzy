import { LocalStore } from '@gauzy/desktop-lib';
import { AuditLogHandler } from '../audit';
import { DesktopOfflineModeHandler, Timer, TimerService } from '../offline';
import {
	ActivityWatchService,
	ActivityWatchEventManager,
} from '../integrations';
import { TimerStatus } from '../timer/timer-status';
import { IOfflineMode } from '../interfaces';
import { QueueHandler } from '../queues/queue';
import * as moment from 'moment';
import {
	IActivityWatchCollectEventData,
	ActivityType,
	TimeLogSourceEnum
} from '@gauzy/contracts';
import { Knex } from 'knex';
import { BrowserWindow, screen } from 'electron';
import { DesktopActiveWindow } from '../desktop-active-window';
import { logger } from '@gauzy/desktop-core';
import { DesktopEventCounter } from '@gauzy/desktop-activity';
import { detectActiveWindow, getScreenshot } from '../desktop-screenshot';
import { metaData } from '../desktop-wakatime';


export class Activity {
	private _auditLogHandler: AuditLogHandler;
	private _timerService: TimerService; // Replace with the actual type of your timer service
	private _timerStatus: TimerStatus;
	private static instance: Activity;
	private intervalTimer: NodeJS.Timeout;
	private _offlineMode: IOfflineMode;
	private _queueHandler: QueueHandler;
	private _activityWatchService: ActivityWatchService;
	private nextScreenshot: number;
	private activitiesCollectionPeriod = 1000;
	private _activeWindow: DesktopActiveWindow;
	private _eventCounter: DesktopEventCounter;
	private _randomSyncPeriod: number;
	private _activities: any[];
	constructor() {
		this._auditLogHandler = AuditLogHandler.getInstance();
		this._timerStatus = TimerStatus.getInstance();
		this._offlineMode = DesktopOfflineModeHandler.instance;
		this._queueHandler = QueueHandler.getInstance('gauzy-activity');
		this._activityWatchService = new ActivityWatchService();
		this.nextScreenshot = 0;
		this._activeWindow = new DesktopActiveWindow();
		this._eventCounter = new DesktopEventCounter();
		this._randomSyncPeriod = 1;
		this._activities = [];
	}

	public static getInstance(): Activity {
		if (!Activity.instance) {
			Activity.instance = new Activity();
		}
		return Activity.instance;
	}

	private calculateTimeRecord() {
		const now = moment();
		this._timerStatus.timeRecordSecond = now.diff(moment(this._timerStatus.timeStart), 'seconds');
		this._timerStatus.timeRecordHours = now.diff(moment(this._timerStatus.timeStart), 'hours');
		this._timerStatus.timeRecordMinute = now.diff(moment(this._timerStatus.timeStart), 'minutes');
	}

	/*
	 * Collect windows and afk activities
	 */
	async collectActivities(setupWindow, knex, timeTrackerWindow) {
		const appSetting = LocalStore.getStore('appSetting');

		let nextScreenShootLock = false;

		if (appSetting.randomScreenshotTime) {
			await this._auditLogHandler.timerAuditInfo(
				`[collectActivities] Stamping startedAt on local timer (id: ${this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null}) before starting random-screenshot activity collection`
			);
			await this._timerService.update(
				new Timer({
					id: this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null,
					startedAt: new Date(),
					synced: false,
					isStartedOffline: true
				})
			);
			await this._auditLogHandler.timerAuditInfo(
				`[collectActivities] Local timer (id: ${this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null}) startedAt stamped — random-screenshot collection interval ready`
			);
		}

		this.intervalTimer = setInterval(async () => {
			try {
				const appSetting = LocalStore.getStore('appSetting');

				await this._queueHandler.processWithQueue(
					`gauzy-queue`,
					{
						type: 'update-duration-timer',
						data: {
							id: this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null,
							duration: moment().diff(moment(this._timerStatus.timeStart), 'milliseconds')
						}
					},
					knex
				);

				if (this._activityWatchService.isConnected) {
					const end = moment().toDate();
					const start = moment(this._timerStatus.timeSlotStart).toDate();
					const data: IActivityWatchCollectEventData = {
						start,
						end,
						timerId: this._timerStatus.lastTimer?.id
					};

					ActivityWatchEventManager.collectActivities(data, timeTrackerWindow);
				}

				this.calculateTimeRecord();

				timeTrackerWindow.webContents.send('timer_push', {
					second: this._timerStatus.timeRecordSecond,
					minute: this._timerStatus.timeRecordMinute,
					hours: this._timerStatus.timeRecordHours
				});

				if (appSetting.randomScreenshotTime) {
					const elapsedTime = Math.floor(moment.duration(this._timerStatus.timeRecordSecond, 'second').asMinutes());
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

	async activitiesCollection(knex, lastTimeSlot) {
		try {
			console.log('Activities Collection Start:', lastTimeSlot);
			const params = LocalStore.beforeRequestParams();
			const appSetting = LocalStore.getStore('appSetting');
			const config = LocalStore.getStore('configs');

			logger.info(`App Setting: ${moment().format()}`, appSetting);
			logger.info(`Config: ${moment().format()}`, config);

			const lastTimerId = this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null;
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
						config &&
						(config.db === 'sqlite' ||
							config.db === 'better-sqlite' ||
							config.db === 'better-sqlite3')
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

	nextTickScreenshot() {
		const appSetting = LocalStore.getStore('appSetting');
		const updatePeriod = appSetting.timer.updatePeriod;
		const tickAdd = this.maxMinAdditionalTime(updatePeriod);
		this._randomSyncPeriod = Math.floor(Math.random() * (tickAdd.max - tickAdd.min + 1)) + tickAdd.min;
		this.nextScreenshot += this._randomSyncPeriod;
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

	async randomScreenshotUpdate(knex: Knex, timeTrackerWindow: BrowserWindow) {
		try {
			await this._activeWindow.updateActivities();
			console.log('Last Timer Id:', this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null);
			const activities = await this.getAllActivities(knex, this._timerStatus.timeSlotStart);
			timeTrackerWindow.webContents.send('prepare_activities_screenshot', activities);
			this.nextTickScreenshot();
			console.log('Timeslot Start Time', this._timerStatus.timeSlotStart);
			this._timerStatus.timeSlotStart = moment();
		} catch (err) {
			console.error('Error on randomScreenshotUpdate', err);
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

		const timeLogId = this._timerStatus.lastTimer ? this._timerStatus.lastTimer.timelogId : null;
		console.log('Time Log Id', timeLogId);

		const lastTimerId = this._timerStatus.lastTimer ? this._timerStatus.lastTimer.id : null;
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
}
