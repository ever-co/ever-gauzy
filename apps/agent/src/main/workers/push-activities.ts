import {
	KbMouseActivityService,
	KbMouseActivityTO,
	TTimeSlot,
	TimerService
} from '@gauzy/desktop-lib';
import {
	KbMouseActivityPool,
	TMouseEvents,
	TimeSlotActivities,
	ActivityType,
	TimeLogSourceEnum,
} from '@gauzy/desktop-activity';
import { ApiService, TResponseTimeSlot } from '../api';
import { getAuthConfig, TAuthConfig, getInitialConfig } from '../util';
import * as moment from 'moment';
import { AgentLogger } from '../agent-logger';
import { environment } from '../../environments/environment';
import * as fs from 'node:fs';
import MainEvent from '../events/events';
import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../../constant';

type TParamsActivities = Omit<TimeSlotActivities, 'recordedAt'> & { recordedAt: string };

class PushActivities {
	static instance: PushActivities;
	private kbMousePool: KbMouseActivityPool;
	private kbMouseActivityService: KbMouseActivityService;
	private apiService: ApiService;
	private agentLogger: AgentLogger;
	private mainEvent: MainEvent;
	private isNetworkError = false;
	private timerService: TimerService;


	constructor() {
		this.kbMouseActivityService = new KbMouseActivityService();
		this.getKbMousePoolModule();
		this.agentLogger = AgentLogger.getInstance();
		this.mainEvent = MainEvent.getInstance();
		this.apiService = ApiService.getInstance();
		this.trayUpdateMenuStatus('network', true);
		this.timerService = new TimerService();
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
			const authConfig = getAuthConfig();
			const activity = await this.kbMouseActivityService.retrieve(
				authConfig?.user?.id,
				authConfig?.user?.employee?.organizationId,
				authConfig?.user?.employee?.tenantId
			);
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

	async saveTimeSlot(activities: KbMouseActivityTO): Promise<Partial<TResponseTimeSlot> | undefined> {
		try {
			const params = this.timeSlotParams(activities);
			if (!params) {
				return;
			}
			this.agentLogger.info(`Preparing send activity recordedAt ${params.recordedAt} to service`);
			const resp = await this.apiService.saveTimeSlot(params);
			if (this.isNetworkError) {
				this.isNetworkError = false;
				this.trayUpdateMenuStatus('network', !this.isNetworkError);
				this.trayStatusHandler('Working');
			}
			console.log(`Time slot saved for activity ${activities.id}:`, resp?.id);
			return resp;
		} catch (error) {
			console.error('error on save timeslot', error);
			this.isNetworkError = true;
			this.trayUpdateMenuStatus('network', !this.isNetworkError);
			this.trayStatusHandler('Network error');
			throw error;
		}
	}

	async imageAccessed(filePath: string) {
		try {
			fs.accessSync(filePath, fs.constants.R_OK);
			return true;
		} catch (error) {
			console.log('access file image error', error);
			return false;
		}
	}

	async uploadCapturedImage(authConfig: TAuthConfig, recordedAt: string, imageTemp: string, timeSlotId?: string) {
		this.agentLogger.info(`image temporary path ${imageTemp}`);
		const isAccessed = await this.imageAccessed(imageTemp);
		if (!isAccessed) {
			return;
		}

		if (!fs.existsSync(imageTemp)) {
			this.agentLogger.info(`temporary image doesn't exists ${imageTemp}`);
			return;
		}

		this.agentLogger.info(`Preparing to save screenshots recordedAt ${recordedAt} in timeSlotId ${timeSlotId}`);
		const respScreenshot = await this.apiService.uploadImages(
			{
				tenantId: authConfig.user.employee.tenantId,
				organizationId: authConfig.user.employee.organizationId,
				recordedAt,
				timeSlotId
			},
			{ filePath: imageTemp }
		);
		if (respScreenshot?.timeSlotId) {
			this.agentLogger.info(
				`Screenshot image successfully added to timeSlotId ${respScreenshot?.timeSlotId}`
			);
			fs.unlinkSync(imageTemp);
			this.agentLogger.info(`temp image unlink from the temp directory`);
			return;
		}
		this.agentLogger.error(
			`Failed to save screenshots to the api with response ${JSON.stringify(respScreenshot)}`
		);
	}

	async saveImage(recordedAt: string, images: string[], timeSlotId?: string) {
		try {
			const auth = getAuthConfig();
			const isAuthenticated = this.handleUserAuth(auth);
			if (!isAuthenticated) {
				return;
			}
			const imagesExists = images && Array.isArray(images) && images.length;
			if (!imagesExists) {
				return;
			}
			await Promise.all(images.map((imageTemp) => this.uploadCapturedImage(auth, recordedAt, imageTemp, timeSlotId)));
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	private getDurationSeconds(timeStart: Date, timeEnd: Date) {
		if (timeStart && timeEnd) {
			return Math.floor((timeEnd.getTime() - timeStart.getTime()) / 1000);
		}
		return 0;
	}

	private getDurationOverAllSeconds(timeStart: Date, timeEnd: Date, afkDuration?: number) {
		if (!(timeStart && timeEnd)) {
			return 0;
		}
		const total = Math.floor((timeEnd.getTime() - timeStart.getTime()) / 1000);
		const afk = afkDuration ?? 0;
		return Math.max(0, total - afk);
	}

	getKeyboardActivities(activities: KbMouseActivityTO, duration: number, auth: TAuthConfig): TParamsActivities[] {
		return [{
			title: 'Keyboard and Mouse',
			duration: duration,
			projectId: null,
			taskId: null,
			date: moment(activities.timeStart).utc().format('YYYY-MM-DD'),
			time: moment(activities.timeStart).utc().format('HH:mm:ss'),
			type: ActivityType.APP,
			organizationContactId: null,
			organizationId: auth?.user?.employee?.organizationId,
			source: TimeLogSourceEnum.DESKTOP,
			recordedAt: moment(activities.timeStart).toISOString(),
			employeeId: auth?.user?.employee?.id,
			metaData: [{
				kbPressCount: activities.kbPressCount,
				kbSequence: (typeof activities.kbSequence === 'string'
					? (() => {
						try {
							return JSON.parse(activities.kbSequence);
						} catch (error) {
							console.error('Failed to parse kbSequence:', error);
							return [];
						}
					})()
					: activities.kbSequence) as number[],
				mouseLeftClickCount: activities.mouseLeftClickCount,
				mouseRightClickCount: activities.mouseRightClickCount,
				mouseMovementsCount: activities.mouseMovementsCount,
				mouseEvents: (typeof activities.mouseEvents === 'string'
					? (() => {
						try {
							return JSON.parse(activities.mouseEvents);
						} catch (error) {
							console.error('Failed to parse mouseEvents:', error);
							return [];
						}
					})()
					: activities.mouseEvents) as TMouseEvents[]
			}]
		}];
	}

	getActiveWindows(activities: KbMouseActivityTO, auth: TAuthConfig): TParamsActivities[] {
		if (typeof activities.activeWindows === 'string') {
			try {
				activities.activeWindows = JSON.parse(activities.activeWindows);
			} catch (error) {
				this.agentLogger.error(`Error parsing activities data to json ${error.message}`);
				return [];
			}

		}
		if (!Array.isArray(activities.activeWindows)) {
			return []
		}
		return activities.activeWindows.map((windowActivity) => ({
			title: windowActivity.name,
			duration: windowActivity.duration,
			projectId: null,
			taskId: null,
			date: moment(activities.timeStart).utc().format('YYYY-MM-DD'),
			time: moment(activities.timeStart).utc().format('HH:mm:ss'),
			type: ActivityType.APP,
			organizationContactId: null,
			organizationId: auth?.user?.employee?.organizationId,
			source: TimeLogSourceEnum.DESKTOP,
			recordedAt: moment(activities.timeStart).toISOString(),
			employeeId: auth?.user?.employee?.id,
			metaData: windowActivity.meta
		}));
	}

	getActivities(activities: KbMouseActivityTO, duration: number, auth: TAuthConfig): TParamsActivities[] {
		return [
			...this.getKeyboardActivities(activities, duration, auth),
			...this.getActiveWindows(activities, auth)
		];
	}

	checkApplicationState(): boolean {
		const initialConfig = getInitialConfig();
		if (!initialConfig?.isSetup) {
			return false;
		}
		return true;
	}

	handleUserAuth(auth: TAuthConfig): boolean {
		if (!this.checkApplicationState()) {
			this.mainEvent.emit(MAIN_EVENT, {
				type: MAIN_EVENT_TYPE.SETUP_EVENT
			});
			return false;
		}
		if (!auth) {
			this.mainEvent.emit(MAIN_EVENT, {
				type: MAIN_EVENT_TYPE.LOGOUT_EVENT
			});

			return false;
		}
		return true;
	}

	timeSlotParams(activities: KbMouseActivityTO): TTimeSlot | undefined {
		const auth = getAuthConfig();
		const isAuthenticated = this.handleUserAuth(auth);
		if (!isAuthenticated) {
			return;
		}
		const overall = this.getDurationOverAllSeconds(new Date(activities.timeStart), new Date(activities.timeEnd), activities.afkDuration);
		const duration = this.getDurationSeconds(new Date(activities.timeStart), new Date(activities.timeEnd));
		return {
			tenantId: auth?.user?.employee?.tenantId,
			organizationId: auth?.user?.employee?.organizationId,
			duration,
			keyboard: activities.kbPressCount,
			mouse: activities.mouseLeftClickCount + activities.mouseRightClickCount,
			overall,
			startedAt: moment(activities.timeStart).toISOString(),
			recordedAt: moment(activities.timeStart).toISOString(),
			activities: this.getActivities(activities, overall, auth),
			employeeId: auth?.user?.employee?.id
		};
	}

	async saveActivities() {
		try {
			await this.saveOfflineTimer();
			const activity = await this.getOldestActivity();
			if (activity?.id) {
				// remove activity from temp local database
				this.agentLogger.info('Got activity from temporary');
				try {
					const timeSlot = await this.saveTimeSlot(activity);
					this.agentLogger.info(`Activity successfully recorded to api with timeSlotId ${timeSlot?.id}`);
					if (timeSlot?.id) {
						await this.saveImage(
							moment(activity.timeStart).toISOString(),
							typeof activity.screenshots === 'string'
								? (() => {
									try {
										return JSON.parse(activity.screenshots);
									} catch (error) {
										console.error('Failed to parse screenshots:', error);
										return [];
									}
								})()
								: activity.screenshots || [],
							timeSlot?.id
						);
						await this.removeCurrentActivity(activity.id);
					}
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

	async saveOfflineTimer() {
		const notSyncTimer = await this.timerService.findToSynced();
		const authConfig = getAuthConfig();
		if (notSyncTimer.length) {
			for (let i = 0; i < notSyncTimer.length; i++) {
				const timerOffline = notSyncTimer[i].timer;
				if (timerOffline?.isStartedOffline) {
					await this.apiService.startTimer({
						organizationId: authConfig?.user?.employee?.organizationId,
						startedAt: timerOffline.startedAt,
						tenantId: authConfig?.user?.employee?.tenantId,
						organizationTeamId: null,
						organizationContactId: null
					});
					await this.timerService.remove({ id: timerOffline?.id });
				}
			}
		}
	}



	poolErrorHandler(error: Error) {
		console.error(error);
		this.agentLogger.error(`Activity polling scheduler error ${JSON.stringify(error)}`);
	}

	private trayStatusHandler(status: 'Working' | 'Error' | 'Network error') {
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT,
			data: {
				trayStatus: status,
				trayUpdateType: 'title'
			}
		});
	}

	private trayUpdateMenuStatus(menuId: 'keyboard_mouse' | 'network' | 'afk', checked: boolean) {
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.TRAY_NOTIFY_EVENT,
			data: {
				trayUpdateType: 'menu',
				trayMenuId: menuId,
				trayMenuChecked: checked
			}
		});
	}
}

export default PushActivities;
