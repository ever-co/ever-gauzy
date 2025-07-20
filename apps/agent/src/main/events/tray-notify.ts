import TrayMenu from "../tray";
import { getTrayIcon, getAppSetting } from '../util';
import { environment } from '../../environments/environment';
import { TEventArgs } from './event-types';

export class TrayNotify {
	private static instance: TrayNotify;
	private trayMenu: TrayMenu;

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
	}
}
