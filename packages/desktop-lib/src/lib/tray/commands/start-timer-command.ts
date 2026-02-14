import { RegisteredWindow } from '@gauzy/desktop-core';
import { LocalStore } from '../../desktop-store';
import { IConfigStore, IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class StartTimerCommand extends MenuCommand {
	constructor(private windowService: IWindowService, private configStore: IConfigStore) {
		super();
	}

	public execute(): void {
		const userLogin = this.configStore.get('auth');
		let timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		// Ensure the timer window exists (create/show if needed)
		if (!timeTrackerWindow) {
			this.windowService.show(RegisteredWindow.TIMER);
			// Re-fetch the window in case `show()` created it synchronously
			timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
		}

		if (!timeTrackerWindow) {
			// Nothing to do if the window couldn't be created or fetched
			return;
		}

		if (userLogin && userLogin.employeeId) {
			this.windowService.webContents(timeTrackerWindow).send('start_from_tray', LocalStore.beforeRequestParams());
		} else {
			// Ensure the timer window is visible so unauthenticated users see the login UI
			this.windowService.show(RegisteredWindow.TIMER);
			// Re-fetch in case show() changed/created the window
			timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
			this.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init');
		}
	}
}
