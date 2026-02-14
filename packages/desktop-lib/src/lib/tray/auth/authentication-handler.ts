import { RegisteredWindow } from '@gauzy/desktop-core';
import { getApiBaseUrl } from '@gauzy/desktop-window';
import { User } from '../../offline';
import { IConfigStore, IUserRepository, IWindowService } from '../interfaces';

export class AuthenticationHandler {
	constructor(
		private userRepository: IUserRepository,
		private configStore: IConfigStore,
		private windowService: IWindowService,
		private config: any
	) {}

	async handleAuthSuccess(arg: any): Promise<void> {
		console.log('Auth Success:', arg);
		await this.updateGlobalConfig();
		await this.saveUser(arg);
		await this.updateAuthStore(arg);
	}

	private async updateGlobalConfig(): Promise<void> {
		const serverConfig = this.configStore.getStore('configs');
		global.variableGlobal = {
			API_BASE_URL: getApiBaseUrl(serverConfig, this.config),
			IS_INTEGRATED_DESKTOP: serverConfig.isLocalServer
		};
	}

	private async saveUser(arg: any): Promise<void> {
		try {
			const user = new User({ ...arg, ...arg.user });
			user.remoteId = arg.userId;
			user.organizationId = arg.organizationId;

			if (user.employee) {
				await this.userRepository.save(user.toObject());
			}
		} catch (error) {
			console.log('Error on save user', error);
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

	async handleLogout(): Promise<void> {
		const timeTrackerWindow = this.windowService.getOne(RegisteredWindow.TIMER);

		this.windowService.webContents(timeTrackerWindow).send('custom_tray_icon', {
			event: 'updateTimer',
			timeText: null
		});

		const appSetting = this.configStore.get('appSetting');

		if (appSetting && appSetting.timerStarted) {
			this.windowService.webContents(timeTrackerWindow).send('stop_from_tray');
		}

		this.windowService.hide(RegisteredWindow.SETTINGS);
		this.windowService.hide(RegisteredWindow.WIDGET);

		await this.userRepository.remove();
		this.configStore.updateAuthSetting({ isLogout: true });
	}
}
