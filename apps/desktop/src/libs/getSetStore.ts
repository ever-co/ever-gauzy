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
		const configs = store.get('configs');
		const auth = store.get('auth');
		const projectInfo = store.get('project');
		return {
			apiHost: configs.isLocalServer
				? `http://localhost:${configs.port}`
				: configs.serverUrl,
			token: auth.token,
			employeeId: auth.employeeId,
			projectId: projectInfo.projectId,
			taskId: projectInfo.taskId,
			note: projectInfo.note
		};
	}
};
