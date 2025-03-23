import * as path from 'path';

class PullActivities {
	static instance: PullActivities;
	constructor() {
		if (!PullActivities.instance) {
			PullActivities.instance = this;
		}
	}

	static getInstance(): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities();
			return PullActivities.instance;
		}
		return PullActivities.instance;
	}

	startTracking() {
		try {
			let libFile = path.join(process.resourcesPath, 'native', 'iohook.node');
			if (process.env.NODE_ENV === 'development') {
				libFile = path.join(__dirname, '../..', 'native', 'iohook.node');
			}
			console.log('libFile', libFile);
			const IoHook = require(libFile);
			IoHook.startTracking((eventType, keyCode) => {
				console.log(`Event: ${eventType}, Keycode: ${keyCode} `);
			})
		} catch (error) {
			console.log('error run iohook', error);
		}
	}
}

export default PullActivities;
