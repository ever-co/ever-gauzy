import { KeyboardMouseEventCounter, KbMouseTimer, KeyboardMouseActivityStores } from '@gauzy/desktop-activity';
import { KbMouseActivityService } from '@gauzy/desktop-lib';

type UserLogin = {
	tenantId: string;
	organizationId: string;
	remoteId: string;
}

class PullActivities {
	static instance: PullActivities;
	private listenerModule: KeyboardMouseEventCounter;
	private timerModule: KbMouseTimer;
	private isStarted: boolean;
	private activityService: KbMouseActivityService = new KbMouseActivityService();
	private readonly tenantId: string;
	private readonly organizationId: string;
	private readonly remoteId: string;
	constructor(user: UserLogin) {
		if (!PullActivities.instance) {
			PullActivities.instance = this;
			this.listenerModule = null;
			this.isStarted = false;
			this.tenantId = user.tenantId;
			this.organizationId = user.organizationId;
			this.remoteId = user.remoteId;
		}
	}

	static getInstance(user: UserLogin): PullActivities {
		if (!PullActivities.instance) {
			PullActivities.instance = new PullActivities(user);
		}
		return PullActivities.instance;
	}

	getListenerModule() {
		try {
			this.listenerModule = KeyboardMouseEventCounter.getInstance();
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
				this.timerProcess();
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
			this.stopTimerProcess();
		} catch (error) {
			console.error('error to stop tracking', error);
		}
	}

	getTimerModule() {
		if (!this.timerModule) {
			this.timerModule = KbMouseTimer.getInstance();
			this.timerModule.setFlushInterval(60);
			this.timerModule.onFlush(this.activityProcess.bind(this));
		}
	}

	timerProcess() {
		this.getTimerModule();
		this.timerModule.start();
	}

	stopTimerProcess() {
		this.getTimerModule();
		this.timerModule.stop();
	}

	async activityProcess(timeData: { timeStart: Date; timeEnd: Date}) {
		try {
			const activityStores = KeyboardMouseActivityStores.getInstance();
			const activities = activityStores.getCurrentActivities();
			await this.activityService.save({
				timeStart: timeData.timeStart,
				timeEnd: timeData.timeEnd,
				tenantId: this.tenantId,
				organizationId: this.organizationId,
				kbPressCount: activities.kbPressCount,
				kbSequence: JSON.stringify(activities.kbSequence),
				mouseLeftClickCount: activities.mouseLeftClickCount,
				mouseRightClickCount: activities.mouseRightClickCount,
				mouseMovementsCount: activities.mouseMovementsCount,
				mouseEvents: JSON.stringify(activities.mouseEvents),
				remoteId: this.remoteId
			});
		} catch (error) {
			console.error('KB/M activity persist failed', error);
		}
	}
}

export default PullActivities;
