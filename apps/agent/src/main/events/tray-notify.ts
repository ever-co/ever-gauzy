import TrayMenu, { translate } from "../tray";
import { getTrayIcon, getAppSetting } from '../util';
import { environment } from '../../environments/environment';
import { TEventArgs } from './event-types';

export class TrayNotify {
	private static instance: TrayNotify;
	private trayMenu: TrayMenu;
	private running = false;

	constructor() {
		this.trayMenu = TrayMenu.getInstance(
			getTrayIcon(),
			true,
			{ helpSiteUrl: environment.COMPANY_SITE_LINK }
		);
	}

	static getInstance(): TrayNotify {
		if (!TrayNotify.instance) {
			TrayNotify.instance = new TrayNotify();
		}
		return TrayNotify.instance;
	}



	public handleTrayNotify(args: TEventArgs) {
		switch (args?.data?.trayUpdateType) {
			case 'title':
				return this.trayMenu.updateTitle(args?.data?.trayStatus);
			case 'menu':
				return this.trayMenu.updateStatus(args?.data?.trayMenuId, args?.data?.trayMenuChecked);
			default:
				break;
		}
	}

	public updateTrayExitMenu() {
		const appSetting = getAppSetting();
		if (typeof appSetting?.allowAgentAppExit !== 'undefined') {
			const canExit: boolean = !!appSetting?.allowAgentAppExit;
			this.trayMenu.updateExitVisibility(canExit);
		}
		// Capture settings may have changed with the same update.
		this.updateTrayMonitoring();
	}

	public updateTrayTimerStatus(running: boolean) {
		this.running = running;
		this.trayMenu.updateTimerMenu(running);
		this.updateTrayMonitoring();
	}

	/**
	 * Issue #9873: tell the worker, in the always-present tray, what the agent captures while it runs.
	 */
	private updateTrayMonitoring() {
		const appSetting = getAppSetting();
		const captures = [translate('TIMER_TRACKER.MONITORING_CAPTURE_TIME', 'time and active applications')];
		if (appSetting?.allowScreenshotCapture) {
			captures.push(translate('TIMER_TRACKER.MONITORING_CAPTURE_SCREENSHOTS', 'screenshots'));
		}
		if (appSetting?.kbMouseTracking) {
			captures.push(translate('TIMER_TRACKER.MONITORING_CAPTURE_INPUT', 'keyboard and mouse activity'));
		}
		this.trayMenu.updateMonitoring(this.running, captures);
	}
}
