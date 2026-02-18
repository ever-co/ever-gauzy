import { RegisteredWindow } from '@gauzy/desktop-core';
import { IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class OpenTimerCommand extends MenuCommand {
	constructor(private windowService: IWindowService) {
		super();
	}

	public execute(): void {
		this.windowService.show(RegisteredWindow.TIMER);
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
		if (!timeTrackerWindow) {
			return;
		}
		this.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init');
	}
}
