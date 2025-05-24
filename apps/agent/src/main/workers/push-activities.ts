import { KbMouseActivityService, KbMouseActivityTO, TTimeSlot } from '@gauzy/desktop-lib';
import { KbMouseActivityPool, TKbMouseActivity } from '@gauzy/desktop-activity';
import { ApiService } from '../api';
import { getAuthConfig } from '../util';
import * as moment from 'moment';
import { AgentLogger } from '../agent-logger';
import { environment } from '../../environments/environment';
import * as fs from 'node:fs';
import * as path from 'node:path';

class PushActivities {
	static instance: PushActivities;
	private kbMousePool: KbMouseActivityPool;
	private kbMouseActivityService: KbMouseActivityService;
	private apiService = ApiService.getInstance();
	private agentLogger: AgentLogger;
	constructor() {
		this.kbMouseActivityService = new KbMouseActivityService();
		this.getKbMousePoolModule();
		this.agentLogger = AgentLogger.getInstance();
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
			this.kbMousePool.setErrorCallback(this.poolErrorHandler.bind(this));
			this.kbMousePool.setPollingInterval(Number(environment.AGENT_POOL_ACTIVITY_INTERVAL || 5000));
		}
	}

	startPooling() {
		try {
			this.kbMousePool?.start();
			this.agentLogger.info('Polling scheduler started');
		} catch (error) {
			console.error('Failed to start push activity pooling', error);
			this.agentLogger.error(`Failed to start push activity pooling ${JSON.stringify(error)}`);
		}
	}

	stopPooling() {
		this.kbMousePool?.stop();
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
			await this.kbMouseActivityService.remove({ id });
		} catch (error) {
			console.error('error on remove current activity', error);
		}
	}

	async saveTimeSlot(activities: KbMouseActivityTO) {
		try {
			const params = this.timeSlotParams(activities);
			const resp = await this.apiService.saveTimeSlot(params);
			console.log(`Time slot saved for activity ${activities.id}:`, resp.status);
		} catch (error) {
			console.error('error on save timeslot', error);
			throw error;
		}
	}

	async saveImage(recordedAt: string, image: string[]) {
		try {
			const auth = getAuthConfig();
			const pathTemp = image && Array.isArray(image) && image.length && image[0];
			this.agentLogger.info(`image temporarry path ${pathTemp}`);
			if (!pathTemp) {
				return;
			}

			if (!fs.existsSync(pathTemp)) {
				this.agentLogger.info(`temporarry image doesn't exists ${pathTemp}`);
				return;
			}

			await this.apiService.uploadImages(
				{
					tenantId: auth.user.employee.tenantId,
					organizationId: auth.user.employee.organizationId,
					recordedAt
				},
				{ filePath: pathTemp }
			);
			fs.unlinkSync(pathTemp);
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	getDurationSeconds(timeStart: Date, timeEnd: Date) {
		if (timeStart && timeEnd) {
			return Math.floor((timeEnd.getTime() - timeStart.getTime()) / 1000);
		}
		return 0;
	}

	getActivities(activities: KbMouseActivityTO): TKbMouseActivity {
		return {
			kbPressCount: activities.kbPressCount,
			kbSequence: activities.kbSequence,
			mouseLeftClickCount: activities.mouseLeftClickCount,
			mouseRightClickCount: activities.mouseRightClickCount,
			mouseMovementsCount: activities.mouseMovementsCount,
			mouseEvents: activities.mouseEvents
		};
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
		};
	}

	async saveActivities() {
		try {
			const activity = await this.getOldestActivity();
			if (!activity?.id) {
				this.agentLogger.info('Got 0 activity from temp');
			}
			if (activity?.id) {
				// remove activity from temp local database
				this.agentLogger.info('Got 1 activity from temp');
				try {
					this.agentLogger.info('Preparing send activity to service');
					await this.saveTimeSlot(activity);
					await this.saveImage(
						moment(activity.timeStart).toISOString(),
						activity.screenshots ? JSON.parse(activity.screenshots) : []
					);
					this.agentLogger.info('request activity successfully');
					await this.removeCurrentActivity(activity.id);
					return true;
				} catch (error) {
					console.error(`Failed to upload activity ${activity.id}`, error);
					this.agentLogger.error(`Failed to upload activity ${activity.id} ${JSON.stringify(error)}`);
					return false;
				}
			}
		} catch (error) {
			console.error('error on save activity', error);
			this.agentLogger.error(`error on save activity ${JSON.stringify(error)}`);
			return false;
		}
	}

	poolErrorHandler(error: Error) {
		console.error(error);
		this.agentLogger.error(`Activity polling scheduler error ${JSON.stringify(error)}`);
	}
}

export default PushActivities;
