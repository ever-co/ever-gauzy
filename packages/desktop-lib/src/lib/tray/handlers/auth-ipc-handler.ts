import { RegisteredWindow } from '@gauzy/desktop-core';
import { ipcMain, Menu } from 'electron';
import { AppWindowManager } from '../../app-window-manager';
import { AuthenticationHandler } from '../auth/authentication-handler';
import { IConfigStore, IWindowService } from '../interfaces';

export class AuthIPCHandler {
	private onAuthStateChanged?: (isAuthenticated: boolean, authData?: any) => void;

	constructor(
		private windowService: IWindowService,
		private configStore: IConfigStore,
		private authHandler: AuthenticationHandler
	) {}

	onAuthChange(callback: (isAuthenticated: boolean, authData?: any) => void): void {
		this.onAuthStateChanged = callback;
	}

	setupHandlers(): void {
		this.setupAuthSuccessHandler();
		this.setupLogoutHandlers();
	}

	private setupAuthSuccessHandler(): void {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		ipcMain.on('auth_success', async (event, arg) => {
			console.log('Auth Success:', arg);

			await this.authHandler.handleAuthSuccess(arg);

			const appConfig = this.configStore.getStore('configs');
			const menuWindowTime = Menu.getApplicationMenu()?.getMenuItemById('window-time-track');
			const menuWindowSetting = Menu.getApplicationMenu()?.getMenuItemById('window-setting');

			if (menuWindowTime) {
				menuWindowTime.visible = appConfig.timeTrackerWindow;
				menuWindowTime.enabled = arg.employeeId ? true : false;
			}

			if (menuWindowSetting) {
				menuWindowSetting.enabled = true;
			}

			if (this.onAuthStateChanged) {
				this.onAuthStateChanged(!!arg.employeeId, arg);
			}

			if (timeTrackerWindow && arg.employeeId) {
				const isGauzyWindow = appConfig.gauzyWindow;
				this.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init', arg);

				if (!isGauzyWindow) {
					this.windowService.show(RegisteredWindow.TIMER);
				}
			}

			event.sender.send('refresh_menu');
		});
	}

	private setupLogoutHandlers(): void {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		ipcMain.handle('FINAL_LOGOUT', async (event, arg) => {
			console.log('Final Logout');

			this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
				event: 'updateTimer',
				timeText: null
			});

			if (this.onAuthStateChanged) {
				this.onAuthStateChanged(false);
			}

			const menuWindowTime = Menu.getApplicationMenu()?.getMenuItemById('window-time-track');
			if (menuWindowTime) {
				menuWindowTime.enabled = false;
			}

			const appSetting = this.configStore.get('appSetting');
			if (appSetting && appSetting.timerStarted) {
				this.windowService.webContents(timeTrackerWindow).send('stop_from_tray');
			}

			this.windowService.getOne(RegisteredWindow.SETTINGS).close?.();
			this.windowService.getOne(RegisteredWindow.WIDGET).close?.();

			const configs = this.configStore.getStore('configs');
			if (configs.gauzyWindow) {
				this.windowService.webContents(timeTrackerWindow).send('clear_store');
				this.windowService.hide(RegisteredWindow.TIMER);
			}

			try {
				const appWindowManager = AppWindowManager.getInstance();
				if (appWindowManager.pluginsWindow) {
					appWindowManager.pluginsWindow.close?.();
				}
			} catch (error) {
				console.error('An error occurred while closing plugin window', error);
			}

			await this.authHandler.handleLogout();
		});

		ipcMain.on('logout', async (evt, arg) => {
			if (timeTrackerWindow) {
				this.windowService.webContents(timeTrackerWindow).send('logout');
			}
		});
	}

	removeHandlers(): void {
		ipcMain.removeAllListeners('auth_success');
		ipcMain.removeAllListeners('logout');
		ipcMain.removeHandler('FINAL_LOGOUT');
	}
}
