import { AdditionalSettingStoreService } from './concretes/additional-setting-store.service';
import { ApplicationSettingStoreService } from './concretes/application-setting-store.service';
import { AuthStoreService } from './concretes/auth-store.service';
import { ConfigStoreService } from './concretes/config-store.service';
import { ProjectStoreService } from './concretes/project-store.service';
import {
	IAdditionalSetting,
	IApplicationConfig,
	IApplicationSetting,
	IConfig,
	IAuth,
	IProject,
	IStoreService
} from './types';

class LocalStore {
	public readonly configService: IStoreService<IConfig>;
	public readonly authService: IStoreService<IAuth>;
	public readonly projectService: IStoreService<IProject>;
	public readonly applicationSettingService: IStoreService<IApplicationSetting>;
	public readonly additionalSettingService: IStoreService<IAdditionalSetting>;

	constructor() {
		this.configService = new ConfigStoreService();
		this.authService = new AuthStoreService();
		this.projectService = new ProjectStoreService();
		this.applicationSettingService = new ApplicationSettingStoreService();
		this.additionalSettingService = new AdditionalSettingStoreService();
	}

	public setDefaults(): void {
		this.authService.setDefault();
		this.projectService.setDefault();
		this.applicationSettingService.setDefault();
	}

	public find(): IApplicationConfig {
		return {
			setting: this.applicationSettingService.find(),
			config: this.configService.find(),
			auth: this.authService.find(),
			project: this.projectService.find(),
			additionalSetting: this.additionalSettingService.find()
		};
	}
}

export const localStore = new LocalStore();
