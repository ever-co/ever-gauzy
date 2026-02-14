import { RegisteredWindow } from '@gauzy/desktop-core';
import { IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class StopTimerCommand extends MenuCommand {
	constructor(private windowService: IWindowService) {
		super();
	}

	execute(): void {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
		this.windowService.webContents(timeTrackerWindow).send('stop_from_tray');
	}
}
