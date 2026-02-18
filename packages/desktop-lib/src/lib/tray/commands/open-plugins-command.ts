import { AppWindowManager } from '../../app-window-manager';
import { MenuCommand } from './menu-command';

export class OpenPluginsCommand extends MenuCommand {
	constructor(private windowPath: any) {
		super();
	}

	async execute(): Promise<void> {
		const appWindowManager = AppWindowManager.getInstance();
		await appWindowManager.initPluginsWindow(this.windowPath.timeTrackerUi);
		appWindowManager.pluginsWindow.show();
	}
}
