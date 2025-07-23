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
	private AppWindow: AppWindow;
	private mainEvent: MainEvent;
	private trayNotify: TrayNotify;
	private pullActivities: PullActivities;

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
		if (!this.pullActivities) {
			this.pullActivities = PullActivities.getInstance();
		}
		this.pullActivities.updateAppUserAuth({
			tenantId: authConfig?.user?.employee?.tenantId,
			organizationId: authConfig?.user?.employee?.organizationId,
			remoteId: authConfig?.user?.id
		});
	}

	private stopAppTracking(logout?: boolean) {
		const authConfig = getAuthConfig();
		this.getPullActivities(authConfig);
		const pushActivities = PushActivities.getInstance();
		this.pullActivities.stopListener();
		this.pullActivities.stopTracking();
		if (logout) {
			pushActivities.stopPooling();
		}
	}

	private startAppTracking() {
		const authConfig = getAuthConfig();
		if (authConfig?.token) {
			this.getPullActivities(authConfig);
			this.pullActivities.startListener();
			this.pullActivities.startTracking();
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

	private updateAppSetting(args: TEventArgs) {
		if (args?.data?.employee) {
			updateAgentSetting(args.data.employee);
			this.trayNotify.updateTrayExitMenu();
			if (this.AppWindow?.settingWindow) {
				const appSetting = getAppSetting();
				this.AppWindow.settingWindow.webContents.send('setting_page_ipc', {
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
			default: break;
		}
	}

	mainListener() {
		this.mainEvent.on(MAIN_EVENT, this.handleEvent.bind(this));
	}
}
