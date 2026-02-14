import { RegisteredWindow } from '@gauzy/desktop-core';
import { LocalStore } from '../../desktop-store';
import { IConfigStore, IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class StartTimerCommand extends MenuCommand {
	constructor(private windowService: IWindowService, private configStore: IConfigStore) {
		super();
	}

	execute(): void {
		const userLogin = this.configStore.get('auth');
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		if (userLogin && userLogin.employeeId) {
			this.windowService.webContents(timeTrackerWindow).send('start_from_tray', LocalStore.beforeRequestParams());
		} else {
			this.windowService.show(RegisteredWindow.TIMER);
			this.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init');
		}
	}
}
