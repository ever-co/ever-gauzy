import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../../constant';
import PullActivities from '../workers/pull-activities';
import PushActivities from '../workers/push-activities';
import AppWindow from '../window-manager';
import MainEvent from './events';
import * as path from 'node:path';
import { TrayNotify } from './tray-notify';
import { TEventArgs } from './event-types';
import { getAuthConfig, delaySync, TAuthConfig, updateAgentSetting, getAppSetting } from '../util';

const appRootPath: string = path.join(__dirname, '../..');

export default class EventHandler {
	private static instance: EventHandler;
	private appWindow: AppWindow;
	private mainEvent: MainEvent;
	private trayNotify: TrayNotify;
	private pullActivities: PullActivities;
	private pushActivities: PushActivities;

	constructor() {
		this.mainEvent = MainEvent.getInstance();
		this.appWindow = AppWindow.getInstance(appRootPath);
		this.trayNotify = TrayNotify.getInstance();
	}

	static getInstance() {
		if (!EventHandler.instance) {
			EventHandler.instance = new EventHandler();
		}
		return EventHandler.instance;
	}

	getPullActivities(authConfig: TAuthConfig) {
		if (!this.pullActivities) {
			this.pullActivities = PullActivities.getInstance();
		}
		this.pullActivities.updateAppUserAuth({
			tenantId: authConfig?.user?.employee?.tenantId,
			organizationId: authConfig?.user?.employee?.organizationId,
			remoteId: authConfig?.user?.id
		});
	}

	getPushActivities() {
		if (!this.pushActivities) {
			this.pushActivities = PushActivities.getInstance();
		}
	}

	private async stopAppTracking(logout?: boolean) {
		const authConfig = getAuthConfig();
		this.getPullActivities(authConfig);
		this.pullActivities.stopListener();
		await this.pullActivities.stopTracking();
		if (logout) {
			this.getPushActivities();
			await this.pushActivities.stopPooling();
		}
	}

	private async startAppTracking() {
		const authConfig = getAuthConfig();
		if (authConfig?.token) {
			this.getPullActivities(authConfig);
			this.pullActivities.startListener();
			await this.pullActivities.startTracking();
		}
	}

	private async handleLogout() {
		if (!this.appWindow.authWindow || this.appWindow.authWindow?.browserWindow?.isDestroyed) {
			this.stopAppTracking(true);
			this.appWindow.closeSettingWindow();
			this.appWindow.closeLogWindow();
			await this.appWindow.initAuthWindow();
			await this.appWindow.authWindow.loadURL();
			this.appWindow.authWindow.show();
		}
	}

	private async handleApplicationSetup() {
		this.stopAppTracking();
		this.appWindow.settingWindow?.close();
		this.appWindow.logWindow?.close();
		await this.appWindow.initSetupWindow();
		this.appWindow.setupWindow.show();
	}

	private async handleInitScreenshot() {
		const authConfig = getAuthConfig();
		this.getPullActivities(authConfig);
		return this.pullActivities.initActivityAndScreenshot();
	}

	private async startTimerApi() {
		this.getPushActivities();
		this.pushActivities.saveOfflineTimer();
	}

	private updateAppSetting(args: TEventArgs) {
		if (args?.data?.employee) {
			updateAgentSetting(args.data.employee);
			this.trayNotify.updateTrayExitMenu();
			if (this.appWindow?.settingWindow) {
				const appSetting = getAppSetting();
				this.appWindow.settingWindow.webContents.send('setting_page_ipc', {
					type: 'app_setting_update',
					data: {
						setting: appSetting
					}
				});
			}
			if (this.pullActivities) {
				if (args?.data?.employee?.trackKeyboardMouseActivity) {
					this.pullActivities.startListener();
				} else {
					this.pullActivities.stopListener();
				}
			}
		}
	}

	private trayTimerStatus() {
		const authConfig = getAuthConfig();
		this.getPullActivities(authConfig);
		this.trayNotify.updateTrayTimerStatus(this.pullActivities.running);
	}

	private async checkStatusTimer() {
		const appSetting = getAppSetting();
		if (appSetting?.alwaysOn && this.appWindow.alwaysOnWindow) {
			this.appWindow.alwaysOnWindow.browserWindow.webContents.send('check_timer_status', Date.now());
		}
	}

	async handleEvent(args: TEventArgs) {
		switch (args.type) {
			case MAIN_EVENT_TYPE.LOGOUT_EVENT:
				return this.handleLogout();
			case MAIN_EVENT_TYPE.SETUP_EVENT:
				return this.handleApplicationSetup();
			case MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT:
				return this.trayNotify.handleTrayNotify(args);
			case MAIN_EVENT_TYPE.START_TIMER: {
				// Delay to ensure system state stabilization network before starting tracking
				await delaySync(500);
				return this.startAppTracking();
			}
			case MAIN_EVENT_TYPE.STOP_TIMER:
				return this.stopAppTracking();
			case MAIN_EVENT_TYPE.UPDATE_APP_SETTING:
				return this.updateAppSetting(args);
			case MAIN_EVENT_TYPE.INIT_SCREENSHOT:
				return this.handleInitScreenshot();
			case MAIN_EVENT_TYPE.START_TIMER_API:
				return this.startTimerApi();
			case MAIN_EVENT_TYPE.CHECK_STATUS_TIMER:
				return this.checkStatusTimer();
			case MAIN_EVENT_TYPE.TRAY_TIMER_STATUS:
				return this.trayTimerStatus();
			default: break;
		}
	}

	mainListener() {
		this.mainEvent.on(MAIN_EVENT, this.handleEvent.bind(this));
	}
}
