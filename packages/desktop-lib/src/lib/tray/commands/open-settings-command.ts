import { ipcMain } from 'electron';
import { AppWindowManager } from '../../app-window-manager';
import { IPathWindow } from '../../interfaces/i-path-window';
import { MenuCommand } from './menu-command';

export class OpenSettingsCommand extends MenuCommand {
	constructor(private readonly windowPath: IPathWindow) {
		super();
	}

	public async execute(): Promise<void> {
		const appWindowManager = AppWindowManager.getInstance();
		const { timeTrackerUi } = this.windowPath;

		if (appWindowManager.settingWindow && !appWindowManager.settingWindow.isDestroyed()) {
			appWindowManager.settingShow('goto_top_menu');
		} else {
			await appWindowManager.initSettingWindow(timeTrackerUi);
			const onReady = () => appWindowManager.settingShow('goto_top_menu');
			ipcMain.once('setting_window_ready', onReady);
			try {
				await appWindowManager.loadSetting(timeTrackerUi);
			} catch (error) {
				ipcMain.removeListener('setting_window_ready', onReady);
				throw error;
			}
		}
		appWindowManager.settingWindow?.show?.();
	}
}
