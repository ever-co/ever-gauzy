import * as path from 'path';

class PullActivities {
	static instance: PullActivities;
	private nativeModule: any;
	private isStarted: boolean;
	constructor() {
		if (!PullActivities.instance) {
			PullActivities.instance = this;
			this.nativeModule = null;
			this.isStarted = false;
		}
	}

	static getInstance(): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities();
			return PullActivities.instance;
		}
		return PullActivities.instance;
	}

	getNativeModule() {
		try {
			let libFile = path.join(process.resourcesPath, 'native', 'iohook.node');
			if (process.env.NODE_ENV === 'development') {
				libFile = path.join(__dirname, '../..', 'native', 'iohook.node');
			}
			const IoHook = require(libFile);
			this.nativeModule = IoHook;
		} catch (error) {
			console.log('error on get native module');
		}
	}

	startTracking() {
		if (!this.nativeModule) {
			this.getNativeModule();
		}
		try {
			if (!this.isStarted) {
				this.nativeModule.startTracking((eventType: unknown, keyCode: unknown) => {
					console.log(`Event: ${eventType}, Keycode: ${keyCode} `);
				});
				this.isStarted = true;
			}
		} catch (error) {
			console.log('error start trackingk', error);
		}
	}

	stopTracking() {
		if (!this.nativeModule) {
			this.getNativeModule();
		}
		try {
			this.nativeModule.stopTracking();
			this.isStarted = false;
		} catch (error) {
			console.log('error to stop tracking');
		}
	}
}

export default PullActivities;
