import {
	IAdditionalSetting,
	IApplicationSetting,
	IConfig,
	IProject,
	IAuth,
	localStore,
	store
} from '@gauzy/desktop-core';

/**
 * Local Store Facade for Desktop App
 */
export const LocalStore = {
	getStore: (source) => {
		return store.get(source);
	},

	getServerUrl: (): string => {
		const { config } = localStore.find();
		return config?.isLocalServer ? `http://localhost:${config.port}` : config.serverUrl;
	},

	beforeRequestParams: () => {
		try {
			const { config, auth, project, setting } = localStore.find();

			return {
				apiHost: config?.isLocalServer ? `http://localhost:${config.port}` : config.serverUrl,
				token: auth?.token || null,
				employeeId: auth?.employeeId || null,
				organizationId: auth?.organizationId || null,
				tenantId: auth?.tenantId || null,
				projectId: project?.projectId || null,
				taskId: project?.taskId || null,
				note: project?.note || null,
				aw: project?.aw || null,
				organizationContactId: project?.organizationContactId || null,
				organizationTeamId: project?.organizationTeamId || null,
				settings: setting
			};
		} catch (error) {
			console.error('Error in beforeRequestParams:', error);
			return null;
		}
	},

	setDefaultApplicationSetting: (): void => {
		try {
			localStore.setDefaults();
		} catch (error) {
			console.log('error set store', error);
		}
	},

	setAllDefaultConfig: (): void => {
		localStore.projectService.setDefault();
		localStore.authService.setDefault();
		localStore.applicationSettingService.setDefault();
		localStore.configService.setDefault();
	},

	updateApplicationSetting: (values: Partial<IApplicationSetting>): void => {
		localStore.applicationSettingService.update(values);
	},

	updateConfigSetting: (values: Partial<IConfig>): void => {
		localStore.configService.update(values);
	},

	updateConfigProject: (values: Partial<IProject>): void => {
		localStore.projectService.update(values);
	},

	updateAuthSetting: (values: Partial<IAuth>): void => {
		localStore.authService.update(values);
	},

	updateAdditionalSetting: (values: Partial<IAdditionalSetting>): void => {
		localStore.additionalSettingService.update(values);
	},

	getAdditionalConfig: (): IAdditionalSetting => {
		return localStore.find().additionalSetting;
	},

	getApplicationConfig: () => {
		const { config, auth, project: activeProject, setting, additionalSetting } = localStore.find();

		return {
			config,
			auth,
			activeProject,
			setting,
			additionalSetting
		};
	},

	setFilePath: (filePath): void => {
		store.set({
			filePath
		});
	},

	setDefaultServerConfig: (): void => {
		localStore.configService.setDefault();
	}
};
