import {
	KeyboardMouseEventCounter,
	KbMouseTimer,
	KeyboardMouseActivityStores,
	ActivityWindow
} from '@gauzy/desktop-activity';
import { KbMouseActivityService, TranslateService, notifyScreenshot, TimerService, Timer } from '@gauzy/desktop-lib';
import AppWindow from '../window-manager';
import * as path from 'node:path';
import { getScreen, getAppSetting, delaySync, TAppSetting, getScreenshotSoundPath, getAuthConfig } from '../util';
import { getScreenshot, TScreenShot } from '../screenshot';
import { Notification } from 'electron';
import { AgentLogger } from '../agent-logger';
import MainEvent from '../events/events';
import { MAIN_EVENT_TYPE, MAIN_EVENT } from '../../constant';
import { ApiService } from '../api';

type UserLogin = {
	tenantId: string;
	organizationId: string;
	remoteId: string;
}

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
	private stoppedDate: Date ;
	private activityStores: KeyboardMouseActivityStores;
	private activityWindow: ActivityWindow;
	constructor() {
		this.listenerModule = null;
		this.isStarted = false;
		this.agentLogger = AgentLogger.getInstance();
		this.appWindow = AppWindow.getInstance(path.join(__dirname, '../..'));
		this.appWindow.initScreenShotNotification();
		this.mainEvent = MainEvent.getInstance();
		this.apiService = ApiService.getInstance();
		this.timerService = new TimerService();
		this.activityStores = KeyboardMouseActivityStores.getInstance();
		this.activityWindow = ActivityWindow.getInstance();
	}

	static getInstance(): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities();
		}
		return PullActivities.instance;
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
			isStartedOffline: true,
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

	async startTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			const appSetting = getAppSetting();
			if (!this.isStarted) {
				this.startedDate = new Date();
				await this.startTimerApi();
				this.agentLogger.info('Listener keyboard and mouse starting');
				if (appSetting?.kbMouseTracking) {
					this.startListener();
				}
				this.timerProcess();
				this.isStarted = true;
			}
		} catch (error) {
			console.error('error start tracking', error);
		}
	}

	async startTimerApi() {
		const authConfig = getAuthConfig();
		try {
			const timer = this.createOfflineTimer(this.startedDate, authConfig?.user?.employee?.id);
			await this.timerService.save(timer);
		} catch (error) {
			this.agentLogger.error(`Start timer error ${error.message}`);
		}
	}

	async stopTimerApi() {
		this.stoppedDate = new Date();
		const authConfig = getAuthConfig();
		try {
			await this.apiService.stopTimer({
				organizationId: authConfig?.user?.employee?.organizationId,
				tenantId: authConfig?.user?.employee?.tenantId,
				startedAt: this.startedDate,
				organizationTeamId: null,
				organizationContactId: null,
				stoppedAt: this.stoppedDate
			});
		} catch (error) {
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

	async stopTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			await this.stopTimerApi();
			this.agentLogger.info('Listener keyboard and mouse stopping');
			this.listenerModule.stopListener();
			this.isStarted = false;
			this.stopTimerProcess();
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
			this.timerStatusHandler('Working');
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
			const img: any = imgs[0];
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
						await delaySync(100);
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
			silent: true,
		});

		notification.show();
		setTimeout(() => {
			notification.close();
		}, 3000);
	}

	buffToB64(imgs: any) {
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

	async activityProcess(timeData: { timeStart: Date; timeEnd: Date }, isScreenshot?: boolean, afkDuration?: number) {
		try {
			let imgs = [];
			this.checkEmployeeSetting();
			if (isScreenshot) {
				imgs = await this.getScreenShot();
			}
			const activities = this.activityStores.getAndResetCurrentActivities();
			const activityWindow = this.activityWindow.retrieveAndFlushActivities();
			await this.activityService.save({
				timeStart: timeData.timeStart,
				timeEnd: timeData.timeEnd,
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
				afkDuration: afkDuration || 0,
				activeWindows: JSON.stringify(activityWindow)
			});
			this.agentLogger.info('Keyboard and mouse activities saved');
		} catch (error: unknown) {
			console.error('KB/M activity persist failed', error);
			this.agentLogger.error(`KB/M activity persist failed ${JSON.stringify(error)}`);
			this.timerStatusHandler('Error');
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

	private timerStatusHandler(status: 'Working' | 'Error' | 'Afk' | 'Network error') {
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
