import { ipcMain } from 'electron';
import { AppWindowManager } from '../../app-window-manager';
import { MenuCommand } from './menu-command';

export class CheckUpdateCommand extends MenuCommand {
	constructor(private windowPath: any) {
		super();
	}

	async execute(): Promise<void> {
		const appWindowManager = AppWindowManager.getInstance();
		if (!appWindowManager.settingWindow) {
			await appWindowManager.initSettingWindow(this.windowPath.timeTrackerUi, null,  false);
			ipcMain.once('setting_window_ready', () => {
				appWindowManager.settingShow('goto_update');
			});
			await appWindowManager.loadSetting(
				this.windowPath.timeTrackerUi,
			);
		} else {
			appWindowManager.settingShow('goto_update');
		}
		appWindowManager.settingWindow?.show?.();
	}
}
