const Store = require('electron-store');
const store = new Store();

export const LocalStore = {
	getStore: (source) => {
		return store.get(source);
	},
	getServerUrl: () => {
		const configs = store.get('configs');
		return configs.isLocalServer ? `http://localhost:${configs.port}` : configs.serverUrl;
	},

	beforeRequestParams: () => {
		try {
			const configs = store.get('configs');
			const auth = store.get('auth');
			const projectInfo = store.get('project');
			const settings = store.get('appSetting');
			return {
				apiHost: configs.isLocalServer ? `http://localhost:${configs.port}` : configs.serverUrl,
				token: auth ? auth.token : null,
				employeeId: auth ? auth.employeeId : null,
				projectId: projectInfo ? projectInfo.projectId : null,
				taskId: projectInfo ? projectInfo.taskId : null,
				organizationId: auth ? auth.organizationId : null,
				tenantId: auth ? auth.tenantId : null,
				note: projectInfo ? projectInfo.note : null,
				aw: projectInfo ? projectInfo.aw : null,
				organizationContactId: projectInfo ? projectInfo.organizationContactId : null,
				organizationTeamId: projectInfo ? projectInfo.organizationTeamId : null,
				settings
			};
		} catch (error) {
			console.log(error);
		}
	},

	setDefaultApplicationSetting: () => {
		try {
			const config = store.get('appSetting');
			const authConfig = store.get('auth');
			if (!authConfig) {
				const defaultConfig = {
					allowScreenshotCapture: true,
					isLogout: true
				};
				store.set({
					auth: defaultConfig
				});
			} else {
				authConfig.auth = typeof authConfig.isLogout === 'undefined' ? true : authConfig.isLogout;
				authConfig.allowScreenshotCapture =
					typeof authConfig.allowScreenshotCapture === 'undefined' ? true : authConfig.allowScreenshotCapture;
				store.set({
					auth: authConfig
				});
			}
			const projectConfig = store.get('project');
			if (!projectConfig) {
				const config = {
					aw: {
						isAw: true
					}
				};
				store.set({
					project: config
				});
			} else {
				projectConfig.aw = typeof projectConfig.aw === 'undefined' ? { isAw: true } : projectConfig.aw;
				store.set({
					appSetting: projectConfig
				});
			}
			if (!config) {
				const defaultAppSetting = {
					monitor: {
						captured: 'all' // ['all', 'active-only']
					},
					timer: {
						updatePeriod: 10 // [1, 5, 10]
					},
					SCREENSHOTS_ENGINE_METHOD: 'ElectronDesktopCapturer',
					screenshotNotification: true,
					simpleScreenshotNotification: false,
					mutedNotification: false,
					autoLaunch: true,
					visibleAwOption: true,
					randomScreenshotTime: false,
					visibleWakatimeOption: false,
					trackOnPcSleep: false,
					awIsConnected: true,
					preventDisplaySleep: false,
					automaticUpdate: true,
					automaticUpdateDelay: 1, //hour
					cdnUpdater: {
						github: false,
						digitalOcean: true
					},
					prerelease: false,
					preferredLanguage: 'en',
					zone: 'local',
					alwaysOn: true,
					enforced: false
				};
				store.set({
					appSetting: defaultAppSetting
				});
			} else {
				config.screenshotNotification =
					typeof config.screenshotNotification === 'undefined' ? true : config.screenshotNotification;
				config.awIsConnected = true;
				store.set({
					appSetting: config
				});
			}
		} catch (error) {
			console.log('error set store', error);
		}
	},

	updateApplicationSetting: (values) => {
		const appSetting = store.get('appSetting');
		store.set({
			appSetting: { ...appSetting, ...values }
		});
	},

	updateConfigSetting: (values) => {
		let configs = store.get('configs');
		configs = { ...configs, ...values };
		store.set({
			configs: configs
		});
	},

	updateConfigProject: (values) => {
		const projects = store.get('project');
		store.set({
			project: { ...projects, ...values }
		});
	},

	updateAuthSetting: (values) => {
		const auth = store.get('auth');
		store.set({
			auth: {
				...auth,
				...values
			}
		});
	},

	updateAdditionalSetting: (values) => {
		const addSetting = store.get('additionalSetting');
		store.set({
			additionalSetting: { ...addSetting, ...values }
		});
	},

	getAdditionalConfig: () => {
		const addSetting = store.get('additionalSetting');
		const values = {};
		if (addSetting) {
			Object.keys(addSetting).forEach((value) => {
				if (addSetting[value]) {
					values[value] = addSetting[value];
				}
			});
		}
		return values;
	},

	getApplicationConfig: () => {
		const configs = store.get('configs');
		const auth = store.get('auth');
		const projectInfo = store.get('project');
		const settings = store.get('appSetting');
		const addSetting = LocalStore.getStore('additionalSetting');

		return {
			setting: settings,
			config: configs,
			auth,
			additionalSetting: addSetting,
			activeProject: projectInfo
		};
	},

	setFilePath: (filePath) => {
		store.set({
			filePath: filePath
		});
	},

	setDefaultServerConfig: () => {
		const configs = {
			autoStart: true,
			secureProxy: {
				secure: true,
				enable: false,
				ssl: {
					key: '',
					cert: ''
				}
			}
		};
		store.set({ configs });
	}
};
