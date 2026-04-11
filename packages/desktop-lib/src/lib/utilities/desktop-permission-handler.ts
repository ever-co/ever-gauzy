import {  BrowserWindow, ipcMain } from "electron";
import { DialogConfirmStartTimerPermission } from "../decorators";
import { DesktopDialog } from "../desktop-dialog";
import { TranslateService } from "../translation";
import { AppWindowManager } from "../app-window-manager";

export class DesktopPermissionHandler {
	private readonly timeTrackerWindow: BrowserWindow;
	static instance: DesktopPermissionHandler;
	private appWindowManager: AppWindowManager;
	private readonly windowPath: { timeTrackerUi: string }
	private isShow: boolean;
	constructor(timeTrackerWindow: BrowserWindow, windowPath: { timeTrackerUi: string }) {
		this.timeTrackerWindow = timeTrackerWindow;
		this.appWindowManager = AppWindowManager.getInstance();
		this.windowPath = windowPath;
		this.isShow = false;
	}

	static getInstance(
		timeTrackerWindow: BrowserWindow,
		windowPath: { timeTrackerUi: string }
	): DesktopPermissionHandler {
		if (!DesktopPermissionHandler.instance) {
			DesktopPermissionHandler.instance = new DesktopPermissionHandler(timeTrackerWindow, windowPath);
		}
		return DesktopPermissionHandler.instance;
	}

	async showDialogPermissionCorfirm() {
		if (this.isShow) {
			return;
		}
		const dialog = new DialogConfirmStartTimerPermission(
			new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.READY_INSTALL'),
				this.timeTrackerWindow
			)
		);
		dialog.options.detail = TranslateService.instant('TIMER_TRACKER.DIALOG.HAS_BEEN_DOWNLOADED');
		const button = await dialog.show();
		if (button?.response === 0) {
			this.timeTrackerWindow.webContents.send('start_timer_anyway');
		} else {
			await this.openSetting()
		}
	}

	async openSetting() {
		const { timeTrackerUi } = this.windowPath;

		if (this.appWindowManager.settingWindow && !this.appWindowManager.settingWindow.isDestroyed()) {
			this.appWindowManager.settingShow('goto_permission');
		} else {
			const onReady = () => this.appWindowManager.settingShow('goto_permission');
			ipcMain.once('setting_window_ready', onReady);
			try {
				await this.appWindowManager.initSettingWindow(timeTrackerUi);
				await this.appWindowManager.loadSetting(timeTrackerUi);
			} catch (error) {
				ipcMain.removeListener('setting_window_ready', onReady);
				throw error;
			}
		}
		this.appWindowManager.settingWindow?.show?.();
	}
}


