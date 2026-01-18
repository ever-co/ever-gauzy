import {
	KeyboardMouseEventCounter,
	KbMouseTimer,
	KeyboardMouseActivityStores,
	ActivityWindow,
	TActivityProcessParam,
	TKbMouseActivity,
	TWindowActivities,
	ActivityState
} from '@gauzy/desktop-activity';
import {
	KbMouseActivityService,
	TranslateService,
	notifyScreenshot,
	TimerService,
	Timer,
	PowerManagerPreventDisplaySleep
} from '@gauzy/desktop-lib';
import AppWindow from '../window-manager';
import * as path from 'node:path';
import {
	getScreen,
	getAppSetting,
	delaySync,
	TAppSetting,
	getScreenshotSoundPath,
	getAuthConfig,
	TAuthConfig,
	updateTimerStatus
} from '../util';
import { getScreenshot, TScreenShot } from '../screenshot';
import { Notification } from 'electron';
import { AgentLogger } from '../agent-logger';
import MainEvent from '../events/events';
import { MAIN_EVENT_TYPE, MAIN_EVENT } from '../../constant';
import { ApiService } from '../api';
import { WorkerQueue } from '../queue/worker-queue';
import * as isOnline from 'is-online';

type UserLogin = {
	tenantId: string;
	organizationId: string;
	remoteId: string;
};

class PullActivities {
	static instance: PullActivities;
	private listenerModule: KeyboardMouseEventCounter;
	private timerModule: KbMouseTimer;
	private isStarted: boolean;
	private activityService: KbMouseActivityService = new KbMouseActivityService();
	private timerService: TimerService;
	private tenantId: string;
	private organizationId: string;
	private remoteId: string;
	private agentLogger: AgentLogger;
	private appWindow: AppWindow;
	private mainEvent: MainEvent;
	private apiService: ApiService;
	private startedDate: Date;
	private stoppedDate: Date;
	private activityStores: KeyboardMouseActivityStores;
	private activityWindow: ActivityWindow;
	private workerQueue: WorkerQueue;
	private powerManagerPreventDisplaySleep: PowerManagerPreventDisplaySleep;
	private currentTimerId: number;
	private lastTodayDuration: number;
	private _startedPausedDate: Date | null;
	private _isPaused: boolean;
	constructor() {
		this.listenerModule = null;
		this.isStarted = false;
		this.agentLogger = AgentLogger.getInstance();
		this.appWindow = AppWindow.getInstance(path.join(__dirname, '../..'));
		this.mainEvent = MainEvent.getInstance();
		this.apiService = ApiService.getInstance();
		this.timerService = new TimerService();
		this.activityStores = KeyboardMouseActivityStores.getInstance();
		this.activityWindow = ActivityWindow.getInstance();
		this.powerManagerPreventDisplaySleep = new PowerManagerPreventDisplaySleep(null);
	}

	static getInstance(): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities();
		}
		return PullActivities.instance;
	}

	public get running(): boolean {
		return this.isStarted;
	}

	public get todayDuration(): number {
		return this.lastTodayDuration;
	}

	public get startedAt(): Date {
		return this.startedDate;
	}

	public get startedPausedDate(): Date | null {
		return this._startedPausedDate;
	}

	public set startedPausedDate(value: Date | null) {
		this._startedPausedDate = value;
	}

	public get isPaused(): boolean {
		return this._isPaused;
	}

	public set isPaused(value: boolean) {
		this._isPaused = value;
	}

	public updateAppUserAuth(user: UserLogin) {
		this.tenantId = user.tenantId;
		this.organizationId = user.organizationId;
		this.remoteId = user.remoteId;
	}

	private createOfflineTimer(startedAt: Date, employeeId: string): Timer {
		return new Timer({
			projectId: null,
			timesheetId: null,
			timelogId: null,
			organizationTeamId: null,
			taskId: null,
			description: null,
			day: null,
			duration: null,
			synced: false,
			isStartedOffline: false,
			isStoppedOffline: false,
			version: null,
			startedAt,
			employeeId
		});
	}

	getListenerModule() {
		try {
			this.listenerModule = KeyboardMouseEventCounter.getInstance();
			this.listenerModule.setKeyboardMouseStatusCallback(this.kbMouseTrackedHandler.bind(this));
		} catch (error) {
			console.error('error on get listener module', error);
		}
	}

	updateAppSetting() {
		updateTimerStatus(this.isStarted);
		this.appWindow.settingWindow?.webContents?.send?.('setting_page_ipc', {
			type: 'app_setting_update',
			data: {
				setting: getAppSetting()
			}
		});
	};

	async startTracking(isResume = false) {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			const appSetting = getAppSetting();
			if (!this.isStarted) {
				this.startedDate = new Date();
				if (!isResume) {
					await this.startTimerApi();
				}
				this.agentLogger.info('Listener keyboard and mouse starting');
				if (appSetting?.kbMouseTracking) {
					this.startListener();
				}
				this.timerProcess();
				this.isStarted = true;
				this.timerStatusHandler('Working');
				this.mainEvent.emit('MAIN_EVENT', {
					type: MAIN_EVENT_TYPE.TRAY_TIMER_STATUS
				});
				this.updateAppSetting();

				if (appSetting?.preventDisplaySleep) {
					this.powerManagerPreventDisplaySleep.start();
				}
			}
		} catch (error) {
			console.error('error start tracking', error);
		}
	}

	initWorkerQueue() {
		if (!this.workerQueue) {
			this.workerQueue = WorkerQueue.getInstance();
		}
	}

	async startTimerApi() {
		const authConfig = getAuthConfig();
		try {
			const online = await isOnline({ timeout: 1200 }).catch(() => false);
			if (online) {
				try {
					const timerStatus = await this.apiService.timerStatus({
						tenantId: authConfig.user.employee.tenantId,
						organizationId: authConfig.user.employee.organizationId
					});
					this.lastTodayDuration = timerStatus?.duration;
				} catch (error) {
					const localTodayDuration = await this.timerService.todayDurations();
					this.lastTodayDuration = localTodayDuration;
				}
			} else {
				const localTodayDuration = await this.timerService.todayDurations();
				this.lastTodayDuration = localTodayDuration;
			}
			const timer = this.createOfflineTimer(this.startedDate, authConfig?.user?.employee?.id);
			const timerData = await this.timerService.saveAndReturn(timer);
			this.currentTimerId = timerData?.id;
			this.initWorkerQueue();
			this.workerQueue.desktopQueue.enqueueTimer({
				attempts: 1,
				queue: 'timer',
				timerId: timerData?.id,
				data: {
					startedAt: this.startedDate.toISOString(),
					stoppedAt: null
				}
			});
			this.mainEvent.emit('MAIN_EVENT', {
				type: MAIN_EVENT_TYPE.INIT_SCREENSHOT
			});
			this.mainEvent.emit('MAIN_EVENT', { type: MAIN_EVENT_TYPE.CHECK_STATUS_TIMER });
		} catch (error) {
			this.agentLogger.error(`Start timer error ${error.message}`);
		}
	}

	async handleManualTimeLog(authConfig: TAuthConfig) {
		const timerLocal = await this.timerService.findById({
			id: this.currentTimerId
		});
		if (timerLocal.timelogId) {
			await this.apiService.updateTimeLog(timerLocal.timelogId, {
				tenantId: authConfig?.user?.employee?.tenantId,
				organizationId: authConfig?.user?.employee?.organizationId,
				startedAt: this.startedDate,
				stoppedAt: this.stoppedDate,
				isBillable: true,
				employeeId: authConfig?.user?.employee?.id
			});
			await this.timerService.update(new Timer({
				id: this.currentTimerId,
				synced: true
			}));
			return;
		}
	}

	async stopTimerApi() {
		this.stoppedDate = new Date();
		const authConfig = getAuthConfig();
		try {
			await this.timerService.update(new Timer({
				id: this.currentTimerId,
				stoppedAt: this.stoppedDate,
			}));
			const online = await isOnline({ timeout: 1200 }).catch(() => false);
			if (online) {
				try {
					await this.apiService.stopTimer({
						organizationId: authConfig?.user?.employee?.organizationId,
						tenantId: authConfig?.user?.employee?.tenantId,
						startedAt: this.startedDate,
						organizationTeamId: null,
						organizationContactId: null,
						stoppedAt: this.stoppedDate
					});
					await this.timerService.update(new Timer({
						id: this.currentTimerId,
						synced: true
					}));
				} catch (error) {
					if (error.status === 406 && error.message?.includes('No running log found')) {
						await this.handleManualTimeLog(authConfig);
					} else {
						console.error('Error stopping timer online', error.message);
						this.workerQueue.desktopQueue.enqueueTimer({
							attempts: 1,
							queue: 'timer',
							timerId: this.currentTimerId,
							data: {
								startedAt: this.startedDate.toISOString(),
								stoppedAt: this.stoppedDate.toISOString(),
								isStopped: true
							}
						});
						this.agentLogger.error(`Error stopping timer online ${error.message}`);
						throw error;
					}
				}
				this.mainEvent.emit('MAIN_EVENT', { type: MAIN_EVENT_TYPE.CHECK_STATUS_TIMER });
				this.timerStatusHandler('Idle');
				return;
			}
			this.workerQueue.desktopQueue.enqueueTimer({
				attempts: 1,
				queue: 'timer',
				timerId: this.currentTimerId,
				data: {
					startedAt: this.startedDate.toISOString(),
					stoppedAt: this.stoppedDate.toISOString(),
					isStopped: true
				}
			});
			this.mainEvent.emit('MAIN_EVENT', { type: MAIN_EVENT_TYPE.CHECK_STATUS_TIMER });
			this.timerStatusHandler('Idle');
		} catch (error) {
			this.mainEvent.emit('MAIN_EVENT', { type: MAIN_EVENT_TYPE.CHECK_STATUS_TIMER });
			this.agentLogger.error(`Stop timer error ${error.message}`);
		}
	}

	startListener() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		this.listenerModule.startListener();
		this.agentLogger.info('Keyboard and mouse activity listener starting');
	}

	stopListener() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		this.listenerModule.stopListener();
		this.agentLogger.info('Keyboard and mouse activity listener stopped');
	}

	async stopTracking(isPaused = false) {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			const appSetting = getAppSetting();
			if (this.isStarted) {
				if (!isPaused) {
					await this.stopTimerApi();
				}
				this.agentLogger.info('Listener keyboard and mouse stopping');
				this.listenerModule.stopListener();
				this.isStarted = false;
				this.stopTimerProcess();
				this.mainEvent.emit('MAIN_EVENT', {
					type: MAIN_EVENT_TYPE.TRAY_TIMER_STATUS
				});
				this.updateAppSetting();

				if (appSetting?.preventDisplaySleep) {
					this.powerManagerPreventDisplaySleep.stop();
				}
				return;
			}
			this.agentLogger.warn('No timer started to stop');
		} catch (error) {
			console.error('error to stop tracking', error);
		}
	}

	private afkEVentHandler(isAfk?: boolean) {
		this.agentLogger.info(`AFK detected`);
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT,
			data: {
				trayUpdateType: 'menu',
				trayMenuChecked: isAfk || false,
				trayMenuId: 'afk'
			}
		});
		if (isAfk) {
			this.timerStatusHandler('Afk');
		} else {
			this.timerStatusHandler(this.isStarted ? 'Working' : 'Idle');
		}
	}

	private kbMouseTrackedHandler(isActive?: boolean) {
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT,
			data: {
				trayUpdateType: 'menu',
				trayMenuChecked: isActive || false,
				trayMenuId: 'keyboard_mouse'
			}
		});
	}

	async collectActivityWindow() {
		try {
			await this.activityWindow.getActiveWindowAndSetDuration();
		} catch (error) {
			this.agentLogger.error(`Active window collection failed: ${error.message}`);
		}
	}

	getTimerModule() {
		if (!this.timerModule) {
			this.timerModule = KbMouseTimer.getInstance();
			this.timerModule.onFlush(this.activityProcess.bind(this));
			this.timerModule.setFlushInterval(60);
			this.timerModule.afkEvent(this.afkEVentHandler.bind(this));
			this.timerModule.setTimerStartedCallback(this.timerStatusHandler.bind(this));
			this.timerModule.setActiveWindowCallback(this.collectActivityWindow.bind(this));
		}
		const appSetting = getAppSetting();
		const screenshotInterval = (appSetting?.timer?.updatePeriod || 5) * 60; // value is in seconds and default to 5 minutes
		this.timerModule.setScreenshotInterval(screenshotInterval);
		this.timerModule.setRandomScreenshotInterval(appSetting?.randomScreenshotTime || false);
		this.agentLogger.info('Agent started with 60 second interval keyboard and mouse activities collected');
		this.agentLogger.info(`screenshot will taken every ${screenshotInterval} seconds`);
	}

	timerProcess() {
		this.getTimerModule();
		this.timerModule.start();
		this.agentLogger.info('Agent is started');
	}

	stopTimerProcess() {
		this.getTimerModule();
		this.timerModule.stop();
		this.agentLogger.info('Agent is stopped');
	}

	async showScreenshot(imgs: TScreenShot[], appSetting: Partial<TAppSetting>) {
		if (imgs.length > 0) {
			/* get random image to show when have more than 1 images */
			const img: any = imgs.length > 1 ? imgs[Math.floor(Math.random() * imgs.length)] : imgs[0];
			await delaySync(500);
			img.img = this.buffToB64(img);
			if (appSetting) {
				if (appSetting.simpleScreenshotNotification) {
					this.showNotification(
						process.env.DESCRIPTION,
						TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.SCREENSHOT_TAKEN')
					);
				} else if (appSetting.screenshotNotification) {
					try {
						await this.appWindow.initScreenShotNotification();
						await notifyScreenshot(
							this.appWindow.notificationWindow,
							img,
							null,
							getScreenshotSoundPath(),
							this.appWindow.notificationWindow.browserWindow
						);
					} catch (error) {
						this.agentLogger.error(`Failed to show screenshot notification ${JSON.stringify(error)}`);
					}
				}
			}
		}
	}

	showNotification(title: string, message: string) {
		const notification = new Notification({
			title: title,
			body: message,
			closeButtonText: TranslateService.instant('BUTTONS.CLOSE'),
			silent: true
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 3000);
	}

	buffToB64(imgs: TScreenShot) {
		const bufferImg: Buffer = Buffer.isBuffer(imgs.img) ? imgs.img : Buffer.from(imgs.img);
		const b64img = bufferImg.toString('base64');
		return b64img;
	}

	async getScreenShot() {
		this.agentLogger.info('Taking screenshot');
		const appSetting = getAppSetting();
		let imgs = [];
		if (appSetting?.allowScreenshotCapture) {
			const screenData = getScreen();
			imgs = await getScreenshot({
				monitor: {
					captured: appSetting?.monitor?.captured
				},
				screenSize: screenData.screenSize,
				activeWindow: screenData.activeWindow
			});
			this.agentLogger.info(`screenshot taken ${imgs.length ? imgs[0].filePath : imgs}`);
			await this.showScreenshot(imgs, appSetting);
		}
		return imgs;
	}

	private collectActivitySnapshot(activityState: ActivityState): {
		activities: TKbMouseActivity;
		activityWindow: TWindowActivities[];
	} {
		if (activityState === ActivityState.active) {
			return {
				activities: this.activityStores.getAndResetCurrentActivities(),
				activityWindow: this.activityWindow.retrieveAndFlushActivities()
			};
		}
		return {
			activities: this.activityStores.defaultValue,
			activityWindow: []
		};
	}

	async activityProcess(payload: TActivityProcessParam) {
		try {
			let imgs = [];
			if (payload.screenShot) {
				imgs = await this.getScreenShot();
			}

			const {
				activities,
				activityWindow
			} = this.collectActivitySnapshot(payload.activityState || ActivityState.active);
			const savedActivity = await this.activityService.saveAndReturn({
				timeStart: payload.timeData.timeStart,
				timeEnd: payload.timeData.timeEnd,
				tenantId: this.tenantId,
				organizationId: this.organizationId,
				kbPressCount: activities.kbPressCount,
				kbSequence: JSON.stringify(activities.kbSequence),
				mouseLeftClickCount: activities.mouseLeftClickCount,
				mouseRightClickCount: activities.mouseRightClickCount,
				mouseMovementsCount: activities.mouseMovementsCount,
				mouseEvents: JSON.stringify(activities.mouseEvents),
				remoteId: this.remoteId,
				screenshots: JSON.stringify(imgs.map((img) => img.filePath)),
				afkDuration: payload.afkDuration || 0,
				activeWindows: JSON.stringify(activityWindow),
				syncedActivity: false,
				isOffline: false,
				timerId: this.currentTimerId,
				activityState: payload.activityState || ActivityState.active
			});
			this.initWorkerQueue();
			this.workerQueue.desktopQueue.enqueueTimeSlot({
				attempts: 1,
				activityId: Number(savedActivity?.id),
				queue: 'time_slot',
				data: {
					timeStart: payload.timeData.timeStart.toISOString(),
					timeEnd: payload.timeData.timeEnd.toISOString(),
					afkDuration: payload.afkDuration
				}
			})
			this.agentLogger.info('Keyboard and mouse activities saved');
		} catch (error: unknown) {
			console.error('KB/M activity persist failed', error);
			this.agentLogger.error(`KB/M activity persist failed ${JSON.stringify(error)}`);
			this.timerStatusHandler('Error');
		}
	}

	async initActivityAndScreenshot() {
		if (!this.startedDate) {
			this.agentLogger.warn('initActivityAndScreenshot skipped: startedDate is not set');
			return;
		}
		const currentTime = new Date();
		return this.activityProcess({
			timeData: {
				timeStart: this.startedDate,
				timeEnd: currentTime
			},
			screenShot: true,
			afkDuration: Math.floor((currentTime.getTime() - this.startedDate.getTime()) / 1000),
			activityState: ActivityState.active
		});
	}

	public async recordIdleTime() {
		if (!this.startedPausedDate) {
			this.agentLogger.warn('idletime skipped: startedPausedDate is not set');
			return
		}
		const currentTime = new Date();
		let idleDuration = Math.floor((currentTime.getTime() - this.startedPausedDate.getTime()) / 1000);

		let chunkStartDate = new Date(this.startedPausedDate.getTime());

		/* Split idle time duration to 10 minutes each minutes */
		while (idleDuration > 0) {
			// The maximum duration for a chunk is 10 minutes (600 seconds).
			const tenMinutesInSeconds = 10 * 60;
			const chunkDuration = Math.min(idleDuration, tenMinutesInSeconds);

			// Calculate the end date for the current chunk.
			const chunkEndDate = new Date(chunkStartDate.getTime() + chunkDuration * 1000);

			await this.activityProcess({
				timeData: {
					timeStart: chunkStartDate,
					timeEnd: chunkEndDate
				},
				screenShot: false,
				afkDuration: chunkDuration,
				activityState: ActivityState.idle
			});

			idleDuration -= chunkDuration;
			chunkStartDate = chunkEndDate;
		}
		this.startedPausedDate = currentTime;
		return;
	}

	/** check employee setting periodically to keep agent setting up to date */
	async checkEmployeeSetting() {
		const authConfig = getAuthConfig();
		if (authConfig?.token && authConfig?.user?.employee?.id) {
			try {
				await this.apiService.getEmployeeSetting(authConfig?.user?.employee?.id);
			} catch (error) {
				this.agentLogger.error(`Error get latest employee setting ${error.message}`);
			}
		}
	}

	private timerStatusHandler(status: 'Working' | 'Error' | 'Afk' | 'Network error' | 'Idle') {
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT,
			data: {
				trayUpdateType: 'title',
				trayStatus: status
			}
		});
	}
}

export default PullActivities;
