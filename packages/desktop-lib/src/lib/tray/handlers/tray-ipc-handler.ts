import { RegisteredWindow } from '@gauzy/desktop-core';
import { ipcMain } from 'electron';
import { TranslateService } from '../../translation';
import { IConfigStore, IWindowService } from '../interfaces';
import { TrayMenuManager } from '../managers/tray-menu-manager';

export class TrayIPCHandler {
	constructor(
		private menuManager: TrayMenuManager,
		private windowService: IWindowService,
		private configStore: IConfigStore
	) {}

	setupHandlers(): void {
		this.setupTimerHandlers();
		this.setupIconHandlers();
		this.setupUserDetailHandler();
	}

	private setupTimerHandlers(): void {
		ipcMain.on('update_tray_start', () => {
			this.menuManager.updateMenuItem('1', { enabled: false });
			this.menuManager.updateMenuItem('0', { visible: true });
			this.menuManager.updateMenuItem('2', { enabled: true });
			const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
			if (timeTrackerWindow) {
				this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
					event: 'startTimer'
				});
			}
		});

		ipcMain.on('update_tray_stop', () => {
			this.menuManager.updateMenuItem('1', { enabled: true });
			this.menuManager.updateMenuItem('0', { visible: false });
			this.menuManager.updateMenuItem('2', { enabled: false });
			const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
			if (timeTrackerWindow) {
				this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
					event: 'stopTimer'
				});
			}
		});

		ipcMain.on('update_tray_time_update', (event, arg) => {
			const auth = this.configStore.get('auth');
			if (auth && auth.employeeId && !auth.isLogout) {
				this.menuManager.updateMenuItem('0', {
					label: TranslateService.instant('TIMER_TRACKER.MENU.NOW_TRACKING', { time: arg })
				});
			}
		});

		ipcMain.on('update_tray_time_title', (event, arg) => {
			const auth = this.configStore.get('auth');
			if (auth && auth.employeeId && !auth.isLogout) {
				const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
				if (timeTrackerWindow) {
					this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
						event: 'updateTimer',
						timeText: arg ? arg.timeRun : null
					});
				}
			}
		});
	}

	private setupIconHandlers(): void {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		if (timeTrackerWindow) {
			this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
				event: 'initCustomIcon'
			});
		}
	}

	private setupUserDetailHandler(): void {
		ipcMain.on('user_detail', (event, arg) => {
			if (arg.employee && arg.employee.organization && arg.employee.organization.name) {
				this.menuManager.updateMenuItem('6', {
					label: arg.employee.organization.name,
					visible: true
				});
			}
		});
	}

	removeHandlers(): void {
		const listeners = [
			'update_tray_start',
			'update_tray_stop',
			'update_tray_time_update',
			'update_tray_time_title',
			'user_detail'
		];

		listeners.forEach((listener) => {
			ipcMain.removeAllListeners(listener);
		});
	}
}
