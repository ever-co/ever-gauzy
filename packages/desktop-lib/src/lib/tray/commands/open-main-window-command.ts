import { RegisteredWindow } from '@gauzy/desktop-core';
import { IWindowService } from '../interfaces';
import { MenuCommand } from './menu-command';

export class OpenMainWindowCommand extends MenuCommand {
	constructor(private windowService: IWindowService) {
		super();
	}

	execute(): void {
		const mainWindow = this.windowService.getOne(RegisteredWindow.MAIN);
		if (mainWindow) {
			mainWindow.focus();
			mainWindow.show();
		}
	}
}
