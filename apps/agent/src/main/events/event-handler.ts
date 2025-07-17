import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../../constant';
import PullActivities from '../workers/pull-activities';
import PushActivities from '../workers/push-activities';
import AppWindow from '../window-manager';
import MainEvent from './events';
import * as path from 'node:path';
import { TrayNotify } from './tray-notify';
import { TEventArgs } from './event-types';
import { getAuthConfig, delaySync, TAuthConfig } from '../util';

const appRootPath: string = path.join(__dirname, '../..');

export default class EventHandler {
	private static instance: EventHandler;
	private AppWindow: AppWindow;
	private mainEvent: MainEvent;
	private trayNotify: TrayNotify;

	constructor() {
		this.mainEvent = MainEvent.getInstance();
		this.AppWindow = AppWindow.getInstance(appRootPath);
		this.trayNotify = TrayNotify.getInstance();
	}

	static getInstance() {
		if (!EventHandler.instance) {
			EventHandler.instance = new EventHandler();
		}
		return EventHandler.instance;
	}

	getPullActivities(authConfig: TAuthConfig) {
		const pullActivities = PullActivities.getInstance({
			tenantId: authConfig?.user?.employee?.tenantId,
			organizationId: authConfig?.user?.employee?.organizationId,
			remoteId: authConfig?.user?.id
		});
		return pullActivities;
	}

	private stopAppTracking(logout?: boolean) {
		const authConfig = getAuthConfig();
		const pullActivities = this.getPullActivities(authConfig);
		const pushActivities = PushActivities.getInstance();
		pullActivities.stopListener();
		pullActivities.stopTracking();
		if (logout) {
			pushActivities.stopPooling();
		}
	}

	private startAppTracking() {
		const authConfig = getAuthConfig();
		if (authConfig?.token) {
			const pullActivities = this.getPullActivities(authConfig);
			pullActivities.startListener();
			pullActivities.startTracking();
		}
	}

	private async handleLogout() {
		if (!this.AppWindow.authWindow || this.AppWindow?.authWindow?.browserWindow?.isDestroyed) {
			this.stopAppTracking(true);
			this.AppWindow.closeSettingWindow();
			this.AppWindow.closeLogWindow();
			await this.AppWindow.initAuthWindow();
			await this.AppWindow.authWindow.loadURL();
			this.AppWindow.authWindow.show();
		}
	}

	private async handleApplicationSetup() {
		this.stopAppTracking();
		this.AppWindow.settingWindow?.close();
		this.AppWindow.logWindow?.close();
		await this.AppWindow.initSetupWindow();
		this.AppWindow.setupWindow.show();
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
			default:
				break;
		}
	}

	mainListener() {
		this.mainEvent.on(MAIN_EVENT, this.handleEvent.bind(this));
	}
}
