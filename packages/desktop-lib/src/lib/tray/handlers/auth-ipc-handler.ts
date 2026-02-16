import { RegisteredWindow } from '@gauzy/desktop-core';
import { BrowserWindow, ipcMain, Menu } from 'electron';
import { AppWindowManager } from '../../app-window-manager';
import { AuthenticationHandler } from '../auth/authentication-handler';
import { IConfigStore, IWindowService } from '../interfaces';

export class AuthIPCHandler {
	private onAuthStateChanged?: (isAuthenticated: boolean, authData?: any) => void;

	constructor(
		private windowService: IWindowService,
		private store: IConfigStore,
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
			console.log('Auth Success');
			await this.authHandler.handleAuthSuccess(arg);

			const appConfig = this.store.getStore('configs');
			this.updateMenuItems(arg.employeeId, appConfig.timeTrackerWindow);
			this.notifyAuthStateChange(!!arg.employeeId, arg);

			if (timeTrackerWindow && arg.employeeId) {
				this.initializeTimeTracker(timeTrackerWindow, arg, appConfig.gauzyWindow);
			}

			event.sender.send('refresh_menu');
		});
	}

	private setupLogoutHandlers(): void {
		ipcMain.handle('FINAL_LOGOUT', async () => {
			console.log('Final Logout');

			const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
			await this.performLogout(timeTrackerWindow);
		});

		ipcMain.on('logout', () => {
			const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);
			if (timeTrackerWindow) {
				this.windowService.webContents(timeTrackerWindow).send('logout');
			}
		});
	}

	private async performLogout(timeTrackerWindow: BrowserWindow): Promise<void> {
		// Clear timer display
		this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
			event: 'updateTimer',
			timeText: null
		});

		this.notifyAuthStateChange(false);
		this.updateMenuItems(false, false);

		await this.handleGauzyWindowLogout(timeTrackerWindow);
		this.closePluginsWindow();

		await this.authHandler.handleLogout();
	}

	private updateMenuItems(hasEmployeeId: boolean, timeTrackerEnabled: boolean): void {
		const menuWindowTime = Menu.getApplicationMenu()?.getMenuItemById('window-time-track');
		const menuWindowSetting = Menu.getApplicationMenu()?.getMenuItemById('window-setting');

		if (menuWindowTime) {
			menuWindowTime.visible = timeTrackerEnabled;
			menuWindowTime.enabled = !!hasEmployeeId;
		}

		if (menuWindowSetting) {
			menuWindowSetting.enabled = !!hasEmployeeId;
		}
	}

	private notifyAuthStateChange(isAuthenticated: boolean, authData?: any): void {
		if (this.onAuthStateChanged) {
			this.onAuthStateChanged(isAuthenticated, authData);
		}
	}

	private initializeTimeTracker(timeTrackerWindow: any, arg: any, isGauzyWindow: boolean): void {
		this.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init', arg);

		if (!isGauzyWindow) {
			this.windowService.show(RegisteredWindow.TIMER);
		}
	}

	private async handleGauzyWindowLogout(timeTrackerWindow: any): Promise<void> {
		const configs = this.store.getStore('configs');

		if (configs.gauzyWindow) {
			this.windowService.webContents(timeTrackerWindow).send('clear_store');
			this.windowService.hide(RegisteredWindow.TIMER);
		}
	}

	private closePluginsWindow(): void {
		try {
			const appWindowManager = AppWindowManager.getInstance();
			appWindowManager.pluginsWindow?.close?.();
		} catch (error) {
			console.error('An error occurred while closing plugin window', error);
		}
	}

	removeHandlers(): void {
		ipcMain.removeAllListeners('auth_success');
		ipcMain.removeAllListeners('logout');
		ipcMain.removeHandler('FINAL_LOGOUT');
	}
}
