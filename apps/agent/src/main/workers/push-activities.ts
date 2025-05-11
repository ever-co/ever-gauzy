import { KbMouseActivityService, KbMouseActivityTO, TTimeSlot } from '@gauzy/desktop-lib';
import { KbMouseActivityPool, TKbMouseActivity } from '@gauzy/desktop-activity';
import { ApiService } from '../api';
import { getAuthConfig } from '../util';
import * as moment from 'moment';

class PushActivities {
	static instance: PushActivities;
	private kbMousePool: KbMouseActivityPool;
	private kbMouseActivityService: KbMouseActivityService;
	constructor() {
		this.kbMouseActivityService = new KbMouseActivityService();
		this.getKbMousePoolModule();
	}

	static getInstance(): PushActivities {
		if (!PushActivities.instance) {
			PushActivities.instance = new PushActivities();

			return PushActivities.instance;
		}
		return PushActivities.instance;
	}


	getKbMousePoolModule() {
		if (!this.kbMousePool) {
			this.kbMousePool = KbMouseActivityPool.getInstance();
			this.kbMousePool.setCallback(this.saveActivities.bind(this));
		}
	}

	startPooling() {
		try {
			this.kbMousePool.start();
		} catch (error) {
			console.error('Failed to start push activity pooling', error);
		}
	}

	stopPooling() {
		this.kbMousePool.stop();
	}

	async getOldestActivity(): Promise<KbMouseActivityTO | null> {
		try {
			const activity = await this.kbMouseActivityService.retrieve();
			return activity;
		} catch (error) {
			console.error('error on get one activity', error);
			return null;
		}
	}

	async removeCurrentActivity(id: number) {
		try {
			await this.kbMouseActivityService.remove({ id })
		} catch (error) {
			console.error('error on remove current activity');
		}
	}

	async saveTimeSlot(activities: KbMouseActivityTO) {
		try {
			const api = new ApiService();
			const params = this.timeSlotParams(activities);
			const resp = await api.saveTimeSlot(params);
			console.log('response', resp);
		} catch (error) {
			console.error('error on save timeslot', error);
			throw error;
		}

	}

	getDurationSeconds(timeStart: Date, timeEnd: Date) {
		return Math.floor((timeEnd.getTime() - timeStart.getTime()) / 1000);
	}

	getActivities(activities: KbMouseActivityTO): TKbMouseActivity {
		return {
			kbPressCount: activities.kbPressCount,
			kbSequence: activities.kbSequence,
			mouseLeftClickCount: activities.mouseLeftClickCount,
			mouseRightClickCount: activities.mouseRightClickCount,
			mouseMovementsCount: activities.mouseMovementsCount,
			mouseEvents: activities.mouseEvents
		}
	}

	timeSlotParams(activities: KbMouseActivityTO): TTimeSlot {
		const auth = getAuthConfig();
		return {
			tenantId: auth.user.employee.tenantId,
			organizationId: auth.user.employee.organizationId,
			duration: this.getDurationSeconds(new Date(activities.timeStart), new Date(activities.timeEnd)),
			keyboard: activities.kbPressCount,
			mouse: activities.mouseLeftClickCount + activities.mouseRightClickCount,
			overall: activities.kbPressCount + activities.mouseRightClickCount + activities.mouseLeftClickCount,
			startedAt: moment(activities.timeStart).toISOString(),
			recordedAt: moment(activities.timeStart).toISOString(),
			activities: this.getActivities(activities),
			employeeId: auth.user.employee.employeeId
		}
	}

	async saveActivities() {
		try {
			const activity = await this.getOldestActivity();
			if (activity?.id) {
				// remove activity from temp local database
				try {
					await this.saveTimeSlot(activity);
					await this.removeCurrentActivity(activity.id);
				} catch (error) {
					console.error(`Failed to upload activity ${activity.id}`, error);
				}

			}
		} catch (error) {
			console.error('error on save activity', error);
		}
	}
}

export default PushActivities;
