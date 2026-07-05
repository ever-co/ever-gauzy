import { RegisteredWindow } from '@gauzy/desktop-core';
import { IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class OpenLogWindowCommand extends MenuCommand {
	constructor(private windowService: IWindowService) {
		super();
	}

	execute(): void {
		const mainWindow = this.windowService.getOne(RegisteredWindow.TIMER);
		if (mainWindow) {
			mainWindow.webContents?.send?.('open_child_window');
		}
	}
}
