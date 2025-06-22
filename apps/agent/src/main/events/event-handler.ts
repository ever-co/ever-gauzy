import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../../constant';
import PullActivities from '../workers/pull-activities';
import PushActivities from '../workers/push-activities';
import AppWindow from '../window-manager';
import MainEvent from './events';
import * as path from 'node:path';
import { TrayNotify } from './tray-notify';
import { TEventArgs } from './event-types';

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

	private stopAppTracking() {
		const pullActivities = PullActivities.getInstance({
			tenantId: null,
			organizationId: null,
			remoteId: null
		});
		const pushActivities = PushActivities.getInstance();
		pullActivities.stopListener();
		pullActivities.stopTracking();
		pushActivities.stopPooling();
	}

	private async handleLogout() {
		this.stopAppTracking();
		this.AppWindow.settingWindow?.close();
		this.AppWindow.logWindow?.close();
		await this.AppWindow.initAuthWindow();
		await this.AppWindow.authWindow.loadURL();
		this.AppWindow.authWindow.show();
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
			default:
				break;
		}
	}

	mainListener() {
		this.mainEvent.on(MAIN_EVENT, this.handleEvent.bind(this));
	}
}
