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

// Lazily-initialized singleton — deferred so that the underlying ElectronStore
// (and its app.getPath('userData') call) does not run before app.ready.
let _localStore: LocalStore | null = null;

export const localStore = new Proxy({} as LocalStore, {
	get(_target, prop) {
		if (!_localStore) _localStore = new LocalStore();
		const value = (_localStore as any)[prop];
		return typeof value === 'function' ? value.bind(_localStore) : value;
	},
	set(_target, prop, value) {
		if (!_localStore) _localStore = new LocalStore();
		(_localStore as any)[prop] = value;
		return true;
	}
});
