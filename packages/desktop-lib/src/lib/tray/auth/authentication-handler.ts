import { RegisteredWindow } from '@gauzy/desktop-core';
import { getApiBaseUrl } from '@gauzy/desktop-window';
import { User } from '../../offline';
import { IConfigStore, IUserRepository, IWindowService } from '../interfaces';
import { AppWindowManager } from '../../app-window-manager';

export class AuthenticationHandler {
	constructor(
		private userRepository: IUserRepository,
		private configStore: IConfigStore,
		private windowService: IWindowService,
		private config: any
	) { }

	/**
	 * Save the account the renderer signed in with (or switched organization to).
	 *
	 * @param options.requireSavedUser By default a user that cannot be saved is only logged, and the sign-in goes on as
	 * before. With `true` (an organization switch, `AUTH_SUCCESS_SAVE`) it rejects instead, before the auth store
	 * changes: the offline timer, screenshots and sync read the employee of the saved user, so carrying on would leave
	 * them in the organization left while the renderer works in the new one.
	 */
	async handleAuthSuccess(
		arg: any,
		{ requireSavedUser = false }: { requireSavedUser?: boolean } = {}
	): Promise<void> {
		console.log('Auth Success');
		await this.updateGlobalConfig();
		await this.saveUser(arg, requireSavedUser);
		await this.updateAuthStore(arg);
	}

	private async updateGlobalConfig(): Promise<void> {
		const serverConfig = this.configStore.getStore('configs');
		global.variableGlobal = {
			API_BASE_URL: getApiBaseUrl(serverConfig, this.config),
			IS_INTEGRATED_DESKTOP: serverConfig.isLocalServer
		};
	}

	private async saveUser(arg: any, required: boolean): Promise<void> {
		try {
			const user = new User({ ...arg, ...arg.user });
			user.remoteId = arg.userId;
			user.organizationId = arg.organizationId;
			if (user.employee) {
				await this.userRepository.save(user.toObject());
			} else if (required) {
				throw new Error('The account has no employee to save');
			}
		} catch (error) {
			console.log('Error on save user', error);
			if (required) {
				throw error;
			}
		}
	}

	private async updateAuthStore(arg: any): Promise<void> {
		const lastUser = this.configStore.get('auth');
		if (lastUser && lastUser.userId !== arg.userId) {
			this.configStore.updateConfigProject({
				projectId: null,
				taskId: null,
				note: null,
				organizationContactId: null,
				organizationTeamId: null
			});
		}
		this.configStore.set({
			auth: { ...arg, isLogout: false }
		});
	}

	async handleLogout(isRestart?: boolean): Promise<void> {
		await this.stopTimerIfRunning();
		this.closeWindows(isRestart);
		await this.clearUserData();
	}

	private async stopTimerIfRunning(): Promise<void> {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		if (!timeTrackerWindow) {
			return;
		}

		// Clear timer display
		this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
			event: 'updateTimer',
			timeText: null
		});

		// Stop timer if running
		const appSetting = this.configStore.get('appSetting');
		if (appSetting?.timerStarted) {
			this.windowService.webContents(timeTrackerWindow).send('stop_from_tray');
		}
	}

	private closeWindows(isRestart?: boolean): void {
		const appWindowManager = AppWindowManager.getInstance();
		if (!isRestart) {
			appWindowManager.settingWindow?.close?.();
		}
		appWindowManager.alwaysOnWindow?.browserWindow?.close?.();
	}

	private async clearUserData(): Promise<void> {
		await this.userRepository.remove();
		this.configStore.updateAuthSetting({ isLogout: true });
	}
}
