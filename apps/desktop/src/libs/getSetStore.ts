const Store = require('electron-store');
const store = new Store();
export const LocalStore = {
	getStore: (source) => {
		return store.get(source);
	},
	getServerUrl: () => {
		const configs = store.get('configs');
		return configs.isLocalServer
			? `http://localhost:${configs.port}`
			: configs.serverUrl;
	},

	beforeRequestParams: () => {
		try {
			const configs = store.get('configs');
			const auth = store.get('auth');
			const projectInfo = store.get('project');
			return {
				apiHost: configs.isLocalServer
					? `http://localhost:${configs.port}`
					: configs.serverUrl,
				token: auth ? auth.token : null,
				employeeId: auth ? auth.employeeId : null,
				projectId: projectInfo ? projectInfo.projectId : null,
				taskId: projectInfo ? projectInfo.taskId : null,
				organizationId: auth ? auth.organizationId : null,
				tenantId: auth ? auth.tenantId : null,
				note: projectInfo ? projectInfo.note : null,
				aw: projectInfo ? projectInfo.aw : null,
				organizationContactId: projectInfo
					? projectInfo.organizationContactId
					: null
			};
		} catch (error) {
			console.log(error);
		}
	},

	setDefaultApplicationSetting: () => {
		try {
			const config = store.get('appSetting');
			if (!config) {
				const defaultAppSetting = {
					monitor: {
						captured: 'all' // ['all', 'active-only']
					},
					timer: {
						updatePeriode: 1 // [1, 5, 10]
					},
					SCREENSHOTS_ENGINE_METHOD: 'ElectronDesktopCapturer'
				};
				store.set({
					appSetting: defaultAppSetting
				});
			}
		} catch (error) {
			console.log('error set store', error);
		}
	},

	updateApplicationSetting: (values) => {
		store.set({
			appSetting: values
		});
	}
};
