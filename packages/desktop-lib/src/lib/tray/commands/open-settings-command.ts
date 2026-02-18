import { ipcMain } from 'electron';
import { AppWindowManager } from '../../app-window-manager';
import { MenuCommand } from './menu-command';

export class OpenSettingsCommand extends MenuCommand {
	constructor(private windowPath: any) {
		super();
	}

	public async execute(): Promise<void> {
		const appWindowManager = AppWindowManager.getInstance();
		if (!appWindowManager.settingWindow) {
			const onReady = () => appWindowManager.settingShow('goto_top_menu');
			ipcMain.once('setting_window_ready', onReady);
			try {
				await appWindowManager.initSettingWindow(this.windowPath.timeTrackerUi);
			} catch (err) {
				ipcMain.removeListener('setting_window_ready', onReady);
				throw err;
			}
			appWindowManager.settingWindow?.show?.();
		} else {
			appWindowManager.settingShow('goto_top_menu');
		}
	}
}
