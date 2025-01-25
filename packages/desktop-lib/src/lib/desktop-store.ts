import {
	IAdditionalSetting,
	IApplicationSetting,
	IConfig,
	IProject,
	IAuth,
	localStore,
	store,
	FilePath
} from '@gauzy/desktop-core';

/**
 * Local Store Facade for Desktop App
 */
export const LocalStore = {
	/**
	 * Retrieves the value stored under a specific key from the local store.
	 *
	 * @param {string} source - The key under which the value is stored.
	 * @returns {any} - The value associated with the given key.
	 */
	getStore: (source: string): any => {
		return store.get(source);
	},

	/**
	 * Retrieves the server URL based on local server settings.
	 *
	 * @returns {string} - The server URL, either local or remote.
	 */
	getServerUrl: (): string => {
		const { config } = localStore.find() ?? {};

		return config?.isLocalServer
			? `http://localhost:${config?.port ?? 3000}` // Defaults to port 3000 if missing
			: config?.serverUrl ?? 'https://api.gauzy.co'; // Default external server URL
	},

	/**
	 * Retrieves parameters required for API requests.
	 *
	 * @returns {object | null} - Object containing API host, authentication, project, and settings.
	 */
	beforeRequestParams: (): Record<string, any> | null => {
		try {
			const { config, auth, project, setting } = localStore.find();
			return {
				apiHost: config.isLocalServer
					? `http://localhost:${config.port ?? 3000}`
					: config.serverUrl ?? 'https://api.gauzy.co',
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

	/**
	 * Sets the default application settings in the local store.
	 */
	setDefaultApplicationSetting: (): void => {
		try {
			localStore.setDefaults();
		} catch (error) {
			console.error('Error setting default application settings:', error);
		}
	},

	/**
	 * Resets all configuration settings to their default values.
	 */
	setAllDefaultConfig: (): void => {
		localStore.projectService.setDefault();
		localStore.authService.setDefault();
		localStore.applicationSettingService.setDefault();
		localStore.configService.setDefault();
	},

	/**
	 * Updates the application settings.
	 *
	 * @param {Partial<IApplicationSetting>} values - Partial object containing the updated settings.
	 */
	updateApplicationSetting: (values: Partial<IApplicationSetting>): void => {
		localStore.applicationSettingService.update(values);
	},

	/**
	 * Updates the configuration settings.
	 *
	 * @param {Partial<IConfig>} values - Partial object containing the updated configuration values.
	 */
	updateConfigSetting: (values: Partial<IConfig>): void => {
		localStore.configService.update(values);
	},

	/**
	 * Updates the project configuration settings.
	 *
	 * @param {Partial<IProject>} values - Partial object containing the updated project values.
	 */
	updateConfigProject: (values: Partial<IProject>): void => {
		localStore.projectService.update(values);
	},

	/**
	 * Updates the authentication settings.
	 *
	 * @param {Partial<IAuth>} values - Partial object containing the updated authentication values.
	 */
	updateAuthSetting: (values: Partial<IAuth>): void => {
		localStore.authService.update(values);
	},

	/**
	 * Updates the additional settings.
	 *
	 * @param {Partial<IAdditionalSetting>} values - Partial object containing the updated additional settings.
	 */
	updateAdditionalSetting: (values: Partial<IAdditionalSetting>): void => {
		localStore.additionalSettingService.update(values);
	},

	/**
	 * Retrieves additional configuration settings.
	 *
	 * @returns {IAdditionalSetting} - The additional settings stored in local storage.
	 */
	getAdditionalConfig: (): IAdditionalSetting => {
		return localStore.find().additionalSetting;
	},

	/**
	 * Retrieves the entire application configuration.
	 *
	 * @returns {object} - The complete application configuration, including settings, auth, and project info.
	 */
	getApplicationConfig: (): Record<string, any> => {
		const { config, auth, project: activeProject, setting, additionalSetting } = localStore.find();
		return {
			config,
			auth,
			activeProject,
			setting,
			additionalSetting
		};
	},

	/**
	 * Sets the file path in the local store.
	 *
	 * @param {FilePath} filePath - The file path object to store.
	 * @throws {Error} If `filePath` is invalid.
	 */
	setFilePath: (filePath: FilePath): void => {
		store.set({ filePath });
	},

	/**
	 * Resets the server configuration to its default values.
	 */
	setDefaultServerConfig: (): void => {
		localStore.configService.setDefault();
	}
};
