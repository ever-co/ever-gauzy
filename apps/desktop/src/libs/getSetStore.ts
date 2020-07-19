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
				note: projectInfo ? projectInfo.note : null,
				aw: projectInfo ? projectInfo.aw : null
			};
		} catch (error) {
			console.log(error);
		}
	}
};
