class PullActivities {
	static instance: PullActivities;
	private listenerModule: any;
	private isStarted: boolean;
	constructor() {
		if (!PullActivities.instance) {
			PullActivities.instance = this;
			this.listenerModule = null;
			this.isStarted = false;
		}
	}

	static getInstance(): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities();
		}
		return PullActivities.instance;
	}

	getListenerModule() {
		try {
			// this is not implemented yet
			this.listenerModule = null;
		} catch (error) {
			console.error('error on get listener module', error);
		}
	}

	startTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			if (!this.isStarted) {
				this.isStarted = true;
			}
		} catch (error) {
			console.error('error start tracking', error);
		}
	}

	stopTracking() {
		if (!this.listenerModule) {
			this.getListenerModule();
		}
		try {
			this.isStarted = false;
		} catch (error) {
			console.error('error to stop tracking', error);
		}
	}
}

export default PullActivities;
