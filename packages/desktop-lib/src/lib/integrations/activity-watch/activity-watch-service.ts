import { IActivityWatchWebEvent, IActivityWatchWindowEvent, TimeLogSourceEnum } from '@gauzy/contracts';
import { ActivityWatchChromeService } from './activity-watch-chrome.service';
import { ActivityWatchFirefoxService } from './activity-watch-firefox-service';
import { ActivityWatchAfkService } from './activity-watch-afk-service';
import { ActivityWatchWindowService } from './activity-watch-window-service';
import { IActivity, IActivityPercentage, IDesktopEvent } from '../../interfaces';
import * as  moment from 'moment';
import { LocalStore } from '../../desktop-store';
import { ActivityWatchBrowserList } from './i-activity-watch-event-service';
import { ActivityWatchEdgeService } from './activity-watch-edge-service';

export class ActivityWatchService {
	private readonly chromeService: ActivityWatchChromeService;
	private readonly firefoxService: ActivityWatchFirefoxService;
	private readonly afkService: ActivityWatchAfkService;
	private readonly windowService: ActivityWatchWindowService;
	private readonly edgeService: ActivityWatchEdgeService;

	constructor() {
		this.chromeService = new ActivityWatchChromeService();
		this.firefoxService = new ActivityWatchFirefoxService();
		this.afkService = new ActivityWatchAfkService();
		this.windowService = new ActivityWatchWindowService();
		this.edgeService = new ActivityWatchEdgeService();
	}

	public async clearAllEvents(): Promise<void> {
		const servicesToClear = [
			this.chromeService,
			this.firefoxService,
			this.afkService,
			this.windowService,
			this.edgeService
		];
		await Promise.all(
			servicesToClear.map(async (service) => {
				try {
					await service.clear();
				} catch (error) {
					console.error(`Error clearing events for ${service.constructor.name}: ${error.message}`, error);
				}
			})
		);
	}

	public async activities(timerId: IDesktopEvent['timerId']): Promise<IActivity[]> {
		try {
			const services = [this.windowService, this.chromeService, this.firefoxService, this.edgeService];

			const [windowEvents, chromeEvents, firefoxEvents, edgeEvents] = await Promise.all(
				services.map((service) => service.find({ timerId }))
			);

			const params = LocalStore.beforeRequestParams();
			const currentDate = moment().utc();
			const lastWindowEvent = windowEvents[windowEvents.length - 1];

			return windowEvents.map((windowEvent) => {
				const metaData = JSON.parse(windowEvent.data) as IActivityWatchWindowEvent['data'];
				let title = metaData.app;

				if (
					Object.values(ActivityWatchBrowserList).some((browser) =>
						metaData.app.toLowerCase().includes(browser.toLowerCase())
					)
				) {
					const mergeWith = (events: IDesktopEvent[]): boolean => {
						const lastEvent = events[events.length - 1];
						const metaDataTitle = metaData.title;

						for (const event of events) {
							const data = JSON.parse(event.data) as IActivityWatchWebEvent['data'];
							const eventRecordedAt = moment(event.recordedAt);

							if (
								(eventRecordedAt.isSameOrAfter(windowEvent.recordedAt) || event === lastEvent) &&
								metaDataTitle.startsWith(data.title)
							) {
								Object.assign(metaData, data);
								windowEvent.type = event.type;
								title = data.title;
								return true;
							}
						}
						return false;
					};
					const merged = mergeWith(chromeEvents) || mergeWith(firefoxEvents) || mergeWith(edgeEvents);
					if (!merged) {
						console.log('No merged events');
					}
				}

				if (lastWindowEvent === windowEvent && windowEvent.duration === 0) {
					windowEvent.duration = moment().diff(windowEvent.recordedAt, 'seconds');
				}

				return {
					title,
					date: currentDate.format('YYYY-MM-DD'),
					time: currentDate.format('HH:mm:ss'),
					duration: Math.floor(windowEvent.duration),
					taskId: params.taskId,
					projectId: params.projectId,
					organizationContactId: params.organizationContactId,
					organizationId: params.organizationId,
					employeeId: params.employeeId,
					source: TimeLogSourceEnum.DESKTOP,
					recordedAt: moment(windowEvent.recordedAt).toDate(),
					type: windowEvent.type,
					metaData
				};
			});
		} catch (error) {
			console.error(`ERROR: Getting activities:`, error);
			return Promise.resolve([]);
		}
	}

	public async activityPercentage(timerId: IDesktopEvent['timerId']): Promise<IActivityPercentage> {
		try {
			const [windowDuration, totalDuration, afkDuration, noAfkDuration] = await Promise.all([
				this.windowService.duration(timerId),
				this.afkService.duration(timerId),
				this.afkService.durationAfk(timerId),
				this.afkService.durationNoAfk(timerId)
			]);

			const systemPercentage = this.normalizeToRange(windowDuration - afkDuration, totalDuration);
			const mousePercentage = this.normalizeToRange(noAfkDuration, totalDuration);
			const keyboardPercentage = this.normalizeToRange(noAfkDuration, totalDuration);

			return {
				systemPercentage,
				mousePercentage,
				keyboardPercentage
			};
		} catch (error) {
			console.error(`ERROR: Getting activities percentage:`, error);
			return {
				systemPercentage: 0,
				mousePercentage: 0,
				keyboardPercentage: 0
			};
		}
	}

	public get isConnected(): boolean {
		const params = LocalStore.beforeRequestParams();
		const setting = LocalStore.getStore('appSetting');
		return params?.aw?.isAw && setting?.awIsConnected;
	}

	private normalizeToRange(value: number, total: number): number {
		if (total <= 0) {
			return 0;
		}
		return Math.min(Math.max(value / total, 0), 1);
	}
}
