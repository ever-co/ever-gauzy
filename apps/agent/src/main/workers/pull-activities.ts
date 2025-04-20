import { KeyboardMouseEventCounter } from '@gauzy/desktop-activity';
class PullActivities {
	static instance: PullActivities;
	private listenerModule: KeyboardMouseEventCounter;
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
			this.listenerModule = new KeyboardMouseEventCounter();
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
				this.listenerModule.startListener();
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
			this.listenerModule.stopListener();
			this.isStarted = false;
		} catch (error) {
			console.error('error to stop tracking', error);
		}
	}
}

export default PullActivities;
