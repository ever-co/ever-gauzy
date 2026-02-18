import { app } from 'electron';
import { MenuCommand } from './menu-command';

export class ExitAppCommand extends MenuCommand {
	execute(): void {
		app.quit();
	}
}
