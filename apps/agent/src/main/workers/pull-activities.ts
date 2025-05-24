import { KeyboardMouseEventCounter, KbMouseTimer, KeyboardMouseActivityStores } from '@gauzy/desktop-activity';
import { KbMouseActivityService, TranslateService, notifyScreenshot } from '@gauzy/desktop-lib';
import AppWindow from '../window-manager';
import * as path from 'node:path';
import { getScreen, getAppSetting, delaySync, TAppSetting } from '../util';
import { getScreenshot, TScreenShot } from '../screenshot';
import { Notification } from 'electron';
import { AgentLogger } from '../agent-logger';

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
	private readonly tenantId: string;
	private readonly organizationId: string;
	private readonly remoteId: string;
	private agentLogger: AgentLogger;
	private appWindow: AppWindow;
	constructor(user: UserLogin) {
		this.listenerModule = null;
		this.isStarted = false;
		this.tenantId = user.tenantId;
		this.organizationId = user.organizationId;
		this.remoteId = user.remoteId;
		this.agentLogger = AgentLogger.getInstance();
		this.appWindow = AppWindow.getInstance(path.join(__dirname, '../..'));
		this.appWindow.initScreenShotNotification();
	}

	static getInstance(user: UserLogin): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities(user);
		}
		return PullActivities.instance;
	}

	getListenerModule() {
		try {
			this.listenerModule = KeyboardMouseEventCounter.getInstance();
		} catch (error) {
			console.error('error on get listener module', error);
		}
	}

	startTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			const appSetting = getAppSetting();
			if (!this.isStarted) {
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

	stopTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			this.agentLogger.info('Listener keyboard and mouse stopping');
			this.listenerModule.stopListener();
			this.isStarted = false;
			this.stopTimerProcess();
		} catch (error) {
			console.error('error to stop tracking', error);
		}
	}

	getTimerModule() {
		if (!this.timerModule) {
			this.timerModule = KbMouseTimer.getInstance();
			this.timerModule.onFlush(this.activityProcess.bind(this));
			this.timerModule.setFlushInterval(60);
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
						await notifyScreenshot(this.appWindow.notificationWindow, img, null, '', null);
					} catch (error) {

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
		const screenData = getScreen();
		const appSetting = getAppSetting();
		const imgs = await getScreenshot({
			monitor: {
				captured: appSetting?.monitor?.captured
			},
			screenSize: screenData.screenSize,
			activeWindow: screenData.activeWindow
		});
		this.agentLogger.info(`screenshot taken ${imgs.length ? imgs[0].filePath : imgs}`)
		await this.showScreenshot(imgs, appSetting);
		return imgs;
	}

	async activityProcess(timeData: { timeStart: Date; timeEnd: Date }, isScreenshot?: boolean) {
		try {
			let imgs = [];
			if (isScreenshot) {
				imgs = await this.getScreenShot();
			}
			const activityStores = KeyboardMouseActivityStores.getInstance();
			const activities = activityStores.getAndResetCurrentActivities();
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
				screenshots: JSON.stringify(imgs.map((img) => img.filePath))
			});
			this.agentLogger.info('Keyboard and mouse activities saved');
		} catch (error: unknown) {
			console.error('KB/M activity persist failed', error);
			this.agentLogger.error(`KB/M activity persist failed ${JSON.stringify(error)}`)
		}
	}
}

export default PullActivities;
