import { RegisteredWindow } from '@gauzy/desktop-core';
import { handleLogoutDialog } from '../../desktop-ipc';
import { IConfigStore, IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class LogoutCommand extends MenuCommand {
	constructor(private windowService: IWindowService, private configStore: IConfigStore) {
		super();
	}

	async execute(): Promise<void> {
		const appSetting = this.configStore.get('appSetting');
		let isLogout = true;
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		if (appSetting?.timerStarted) {
			isLogout = await handleLogoutDialog(timeTrackerWindow);
		}

		if (isLogout) {
			this.windowService.webContents(timeTrackerWindow).send('logout');
		}
	}
}
