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
	updateTimerStatus,
	updateOrganizationTimerSetting,
	updateOrganizationScreenshotCapture,
	screenshotCaptureAllowed
} from '../util';
import { resolveScreenshotIntervalSeconds } from '../screenshot-interval';
import { getScreenshot, TScreenShot } from '../screenshot';
import { Notification } from 'electron';
import { AgentLogger } from '../agent-logger';
import MainEvent from '../events/events';
import { MAIN_EVENT_TYPE, MAIN_EVENT } from '../../constant';
import { ApiService } from '../api';
import { WorkerQueue } from '../queue/worker-queue';
import isOnline from 'is-online';

type UserLogin = {
	tenantId: string;
	organizationId: string;
	remoteId: string;
};

/**
 * How often a running agent re-reads the organisation's timer settings, so a screenshot frequency changed on the server
 * reaches an agent that runs for days without restarting (it also re-reads them each time tracking starts or resumes).
 */
const ORGANIZATION_SETTING_REFRESH_MS = 15 * 60 * 1000;

/** A settings request that has not completed by then is abandoned, so it cannot hold up later refreshes */
const ORGANIZATION_SETTING_TIMEOUT_MS = 30 * 1000;

/**
 * Tracking transitions (start, stop, sleep, wake-up) run one after the other. One stuck on the network holds the next
 * back at most this long, so it cannot block tracking for good.
 */
const TRANSITION_LIMIT_MS = 60 * 1000;

/** A device sleep that paused running tracking, keeping its timer open so the wake-up can continue it */
type TSleepPause = {
	/** When the sleep paused tracking */
	pausedAt: Date;
	/**
	 * End of the sleep time recorded as idle activity, or being recorded right now. A stop while paused closes the
	 * timer here, so no recorded activity ends after the timer.
	 */
	idleUntil: Date;
	/** Set by a stop while paused: the wake-up records no further sleep time for this pause */
	cancelled: boolean;
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
	/** The device sleep that paused tracking, until the wake-up resumes it or the person stops it */
	private sleepPause: TSleepPause | null = null;
	/** Starts, stops, sleeps and wake-ups are handled one after the other, in the order they were requested */
	private transitions: Promise<void> = Promise.resolve();
	/** The person's stops requested and not completed yet */
	private pendingStops = 0;
	/** Screenshot interval (seconds) last handed to the timer module */
	private screenshotIntervalSeconds: number | null = null;
	/** Counts tracking sessions, so settings requested for an earlier session are dropped */
	private trackingSession = 0;
	private organizationSettingRequest: { key: string; promise: Promise<void> } | null = null;
	private organizationSettingTimer: ReturnType<typeof setInterval> | null = null;
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

	/** Start of the sleep time not recorded yet, while a device sleep keeps tracking paused */
	public get startedPausedDate(): Date | null {
		return this.sleepPause?.idleUntil ?? null;
	}

	/** Tracking is paused by a device sleep, its timer kept open for the wake-up */
	public get isPaused(): boolean {
		return this.sleepPause !== null;
	}

	/**
	 * A device sleep: stop capturing but keep the timer open, so the wake-up can continue it. Nothing is paused when
	 * tracking is not running (the person stopped it, or it never started).
	 */
	public pauseForSleep(): Promise<void> {
		return this.queueTransition(async () => {
			// A stop the person requested and that is still closing the timer leaves nothing to pause
			if (!this.isStarted || this.pendingStops > 0) {
				return;
			}
			await this.stopTrackingNow(true);
			const pausedAt = new Date();
			this.sleepPause = { pausedAt, idleUntil: pausedAt, cancelled: false };
		});
	}

	/**
	 * A wake-up: record the sleep as idle time and resume tracking, but only tracking that a sleep paused. Tracking the
	 * person stopped, before the sleep or while it kept tracking paused, stays stopped. A repeated wake-up event finds
	 * nothing left to resume, so the sleep time is recorded once.
	 */
	public resumeAfterSleep(): Promise<void> {
		return this.queueTransition(async () => {
			const pause = this.sleepPause;
			if (!pause) {
				this.agentLogger.info('Device resumed: no tracking was paused by the sleep, so nothing resumes');
				return;
			}
			await this.recordIdleTime(pause);
			if (this.sleepPause !== pause || pause.cancelled) {
				// The person stopped tracking while the sleep time was being recorded: their stop, queued next, closes
				// the timer where the recorded sleep time ends
				return;
			}
			this.sleepPause = null;
			await this.startTrackingNow(true);
		});
	}

	/**
	 * Run a transition after the ones requested before it. The returned promise settles when this transition is done;
	 * the next one waits for it, but at most `TRANSITION_LIMIT_MS`.
	 */
	private queueTransition(transition: () => Promise<void>): Promise<void> {
		let done: Promise<void> = Promise.resolve();
		const turn = this.transitions.then(() => {
			done = transition().catch((error) => {
				this.agentLogger.error(`Tracking transition failed: ${error?.message}`);
			});
			return this.holdAtMost(done, TRANSITION_LIMIT_MS);
		});
		this.transitions = turn;
		return turn.then(() => done);
	}

	private holdAtMost(transition: Promise<void>, limitMs: number): Promise<void> {
		let limit: ReturnType<typeof setTimeout>;
		const overrun = new Promise<void>((resolve) => {
			limit = setTimeout(() => {
				this.agentLogger.warn(`A tracking transition runs past ${limitMs / 1000} s; the next goes ahead`);
				resolve();
			}, limitMs);
		});
		return Promise.race([transition, overrun]).finally(() => clearTimeout(limit));
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

	/** Start tracking, once the transitions requested before it (a stop still closing its timer, a sleep) are done */
	startTracking(isResume = false): Promise<void> {
		return this.queueTransition(() => this.startTrackingNow(isResume));
	}

	private async startTrackingNow(isResume = false) {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			const appSetting = getAppSetting();
			if (!this.isStarted) {
				this.trackingSession += 1;
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
				this.startOrganizationSettingRefresh();
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

	async handleManualTimeLog(
		authConfig: TAuthConfig,
		timer: { timerId: number; startedAt: Date; stoppedAt: Date } = {
			timerId: this.currentTimerId,
			startedAt: this.startedDate,
			stoppedAt: this.stoppedDate
		}
	) {
		const timerLocal = await this.timerService.findById({
			id: timer.timerId
		});
		if (timerLocal.timelogId) {
			await this.apiService.updateTimeLog(timerLocal.timelogId, {
				tenantId: authConfig?.user?.employee?.tenantId,
				organizationId: authConfig?.user?.employee?.organizationId,
				startedAt: timer.startedAt,
				stoppedAt: timer.stoppedAt,
				isBillable: true,
				employeeId: authConfig?.user?.employee?.id
			});
			await this.timerService.update(new Timer({
				id: timer.timerId,
				synced: true
			}));
			return;
		}
	}

	async stopTimerApi(stoppedAt?: Date) {
		// The timer this stop closes, read before any await: a start that follows cannot get its timer closed instead
		const timerId = this.currentTimerId;
		const startedAt = this.startedDate;
		const stoppedDate = stoppedAt ?? new Date();
		this.stoppedDate = stoppedDate;
		const authConfig = getAuthConfig();
		try {
			await this.timerService.update(new Timer({
				id: timerId,
				stoppedAt: stoppedDate,
			}));
			const online = await isOnline({ timeout: 1200 }).catch(() => false);
			if (online) {
				try {
					await this.apiService.stopTimer({
						organizationId: authConfig?.user?.employee?.organizationId,
						tenantId: authConfig?.user?.employee?.tenantId,
						startedAt,
						organizationTeamId: null,
						organizationContactId: null,
						stoppedAt: stoppedDate
					});
					await this.timerService.update(new Timer({
						id: timerId,
						synced: true
					}));
				} catch (error) {
					if (error.status === 406 && error.message?.includes('No running log found')) {
						await this.handleManualTimeLog(authConfig, { timerId, startedAt, stoppedAt: stoppedDate });
					} else {
						console.error('Error stopping timer online', error.message);
						this.workerQueue.desktopQueue.enqueueTimer({
							attempts: 1,
							queue: 'timer',
							timerId,
							data: {
								startedAt: startedAt.toISOString(),
								stoppedAt: stoppedDate.toISOString(),
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
				timerId,
				data: {
					startedAt: startedAt.toISOString(),
					stoppedAt: stoppedDate.toISOString(),
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

	/**
	 * Stop tracking (with `isPaused`, pause it for a sleep, keeping the timer open), once the transitions requested
	 * before it are done. The person's stop counts from the moment it is requested, before it waits for anything: it
	 * cancels the sleep-time recording of a wake-up in progress, and a sleep arriving before it completes pauses
	 * nothing.
	 */
	stopTracking(isPaused = false): Promise<void> {
		if (isPaused) {
			return this.queueTransition(() => this.stopTrackingNow(true));
		}
		this.pendingStops += 1;
		if (this.sleepPause) {
			this.sleepPause.cancelled = true;
		}
		return this.queueTransition(async () => {
			try {
				await this.stopTrackingNow(false);
			} finally {
				this.pendingStops -= 1;
			}
		});
	}

	private async stopTrackingNow(isPaused = false) {
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
				this.stopOrganizationSettingRefresh();
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
			if (!isPaused && this.sleepPause) {
				// Stopped while a device sleep keeps tracking paused: drop the pause so waking up does not resume
				// tracking the person stopped, stop recording its sleep time, and close the timer the sleep left open
				// where the recorded sleep time ends (the moment it paused when none is recorded yet), so no recorded
				// activity outlasts the timer.
				const pause = this.sleepPause;
				this.sleepPause = null;
				pause.cancelled = true;
				this.agentLogger.info('Tracking paused by sleep is stopped; it will not resume on wake-up');
				await this.stopTimerApi(pause.idleUntil);
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
		// The organisation's screenshot frequency once read (stored as timer.updatePeriod), else 5 minutes
		const screenshotInterval = resolveScreenshotIntervalSeconds(appSetting);
		this.timerModule.setScreenshotInterval(screenshotInterval);
		this.timerModule.setRandomScreenshotInterval(appSetting?.randomScreenshotTime || false);
		this.screenshotIntervalSeconds = screenshotInterval;
		this.agentLogger.info('Agent started with 60 second interval keyboard and mouse activities collected');
		this.agentLogger.info(`screenshot will taken every ${screenshotInterval} seconds`);
	}

	/**
	 * Read the organisation's timer settings again and, when its screenshot frequency changed, apply it to the running
	 * capture schedule. A failure (offline, server error) keeps the current interval.
	 */
	refreshOrganizationSetting(): Promise<void> {
		const scope = this.organizationSettingScope();
		if (!scope) {
			return Promise.resolve();
		}
		// One request per account and tracking session: a new session or another account sends its own
		if (this.organizationSettingRequest?.key === scope.key) {
			return this.organizationSettingRequest.promise;
		}
		const request = { key: scope.key, promise: null as Promise<void> | null };
		request.promise = this.readOrganizationSetting(scope).finally(() => {
			// An older request settling late must not drop the current one
			if (this.organizationSettingRequest === request) {
				this.organizationSettingRequest = null;
			}
		});
		this.organizationSettingRequest = request;
		return request.promise;
	}

	/** The signed-in account and tracking session settings are read for, or `null` when signed out */
	private organizationSettingScope(): { key: string; organizationId: string } | null {
		const auth = getAuthConfig();
		if (!auth?.token) {
			return null;
		}
		const employee = auth.user?.employee;
		const organizationId = employee?.organizationId;
		return {
			key: [auth.user?.id, employee?.id, organizationId, employee?.tenantId, this.trackingSession].join('|'),
			organizationId
		};
	}

	private async readOrganizationSetting(scope: { key: string; organizationId: string }): Promise<void> {
		try {
			const organization = await this.apiService.getOrganizationTimerSetting(ORGANIZATION_SETTING_TIMEOUT_MS);
			// Drop a response that no longer belongs to the signed-in account (signed out, or another account signed
			// in) or to the running tracking session, and one for another organisation than the agent's
			if (this.organizationSettingScope()?.key !== scope.key) {
				this.agentLogger.info('Organisation timer settings dropped: the account or tracking session changed');
				return;
			}
			if (organization?.id && organization.id !== scope.organizationId) {
				this.agentLogger.warn('Organisation timer settings dropped: they belong to another organisation');
				return;
			}
			if (updateOrganizationTimerSetting(organization) !== null) {
				this.applyScreenshotInterval();
			}
			// The tray says whether screenshots are captured: tell it when the organisation turned capture off or on
			if (updateOrganizationScreenshotCapture(organization)) {
				this.mainEvent.emit(MAIN_EVENT, { type: MAIN_EVENT_TYPE.TRAY_TIMER_STATUS });
			}
		} catch (error) {
			this.agentLogger.warn(`Organisation timer settings not refreshed: ${error?.message}`);
		}
	}

	/** Hand a changed screenshot interval to the running timer module */
	private applyScreenshotInterval() {
		if (!this.timerModule || !this.isStarted) {
			return;
		}
		const appSetting = getAppSetting();
		const screenshotInterval = resolveScreenshotIntervalSeconds(appSetting);
		if (screenshotInterval === this.screenshotIntervalSeconds) {
			return;
		}
		this.timerModule.setScreenshotInterval(screenshotInterval);
		this.timerModule.setRandomScreenshotInterval(appSetting?.randomScreenshotTime || false);
		this.screenshotIntervalSeconds = screenshotInterval;
		this.agentLogger.info(`screenshot interval changed by the organisation: every ${screenshotInterval} seconds`);
	}

	private startOrganizationSettingRefresh() {
		void this.refreshOrganizationSetting();
		if (!this.organizationSettingTimer) {
			this.organizationSettingTimer = setInterval(() => {
				void this.refreshOrganizationSetting();
			}, ORGANIZATION_SETTING_REFRESH_MS);
		}
	}

	private stopOrganizationSettingRefresh() {
		if (this.organizationSettingTimer) {
			clearInterval(this.organizationSettingTimer);
			this.organizationSettingTimer = null;
		}
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
		if (screenshotCaptureAllowed(appSetting)) {
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
		// The timer the activity belongs to, read before any await: a stop and a new start may follow meanwhile
		const timerId = this.currentTimerId;
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
				timerId,
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

	/**
	 * Record a pause's sleep time as idle activity, in chunks of up to 10 minutes. A stop while paused cancels it: the
	 * chunk being written completes (the stop closes the timer at its end) and no further chunk is written.
	 */
	private async recordIdleTime(pause: TSleepPause) {
		const currentTime = new Date();
		let idleDuration = Math.floor((currentTime.getTime() - pause.idleUntil.getTime()) / 1000);

		let chunkStartDate = new Date(pause.idleUntil.getTime());

		/* Split idle time duration to 10 minutes each minutes */
		while (idleDuration > 0 && !pause.cancelled) {
			// The maximum duration for a chunk is 10 minutes (600 seconds).
			const tenMinutesInSeconds = 10 * 60;
			const chunkDuration = Math.min(idleDuration, tenMinutesInSeconds);

			// Calculate the end date for the current chunk.
			const chunkEndDate = new Date(chunkStartDate.getTime() + chunkDuration * 1000);

			// Claim the chunk before writing it, so a stop arriving meanwhile closes the timer at its end
			pause.idleUntil = chunkEndDate;
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
