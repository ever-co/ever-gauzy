import { IActivityWatchWebEvent, IActivityWatchWindowEvent, IDateRange, TimeLogSourceEnum } from '@gauzy/contracts';
import { ActivityWatchChromeService } from './activity-watch-chrome.service';
import { ActivityWatchFirefoxService } from './activity-watch-firefox-service';
import { ActivityWatchAfkService } from './activity-watch-afk-service';
import { ActivityWatchWindowService } from './activity-watch-window-service';
import { IActivity, IActivityPercentage, IDesktopEvent } from '../../interfaces';
import moment from 'moment';
import { LocalStore } from '../../desktop-store';
import { ActivityWatchBrowserList } from './i-activity-watch-event-service';

export class ActivityWatchService {
	private readonly chromeService: ActivityWatchChromeService;
	private readonly firefoxService: ActivityWatchFirefoxService;
	private readonly afkService: ActivityWatchAfkService;
	private readonly windowService: ActivityWatchWindowService;

	constructor() {
		this.chromeService = new ActivityWatchChromeService();
		this.firefoxService = new ActivityWatchFirefoxService();
		this.afkService = new ActivityWatchAfkService();
		this.windowService = new ActivityWatchWindowService();
	}

	public async clearAllEvents(): Promise<void> {
		const servicesToClear = [this.chromeService, this.firefoxService, this.afkService, this.windowService];
		await Promise.all(
			servicesToClear.map(async (service) => {
				try {
					await service.clear();
				} catch (error) {
					console.error(`Error clearing events for ${service.constructor.name}: ${error.message}`);
				}
			})
		);
	}

	public async activities(timerId: IDesktopEvent['timerId']): Promise<IActivity[]> {
		try {
			const services = [this.windowService, this.chromeService, this.firefoxService];

			const [windowEvents, chromeEvents, firefoxEvents] = await Promise.all(
				services.map((service) => service.find({ timerId }))
			);

			const params = LocalStore.beforeRequestParams();
			const currentDate = moment().utc();
			const lastWindowEvent = windowEvents[windowEvents.length - 1];

			return windowEvents.map((windowEvent) => {
				const metaData = JSON.parse(windowEvent.data) as IActivityWatchWindowEvent['data'];

				if (Object.values(ActivityWatchBrowserList).some((browser) => metaData.app.includes(browser))) {
					const mergeWith = (events: IDesktopEvent[]) => {
						const lastEvent = events[events.length - 1];
						const metaDataTitle = metaData.title;

						for (const event of events) {
							const data = JSON.parse(event.data) as IActivityWatchWebEvent['data'];
							const eventRecordedAt = moment(event.recordedAt);

							if (
								(eventRecordedAt.isSame(windowEvent.recordedAt) ||
									(event === lastEvent && event.duration > 0)) &&
								metaDataTitle.startsWith(data.title)
							) {
								Object.assign(metaData, data);
								windowEvent.type = event.type;
							}
						}
					};
					mergeWith(chromeEvents);
					mergeWith(firefoxEvents);
				}

				if (windowEvent === lastWindowEvent && windowEvent.duration === 0) {
					windowEvent.duration = moment().diff(lastWindowEvent.recordedAt, 'seconds');
				}

				return {
					title: metaData.app,
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

			console.log('Percentage', {
				windowActivityDuration: windowDuration,
				totalActivityDuration: totalDuration,
				afkDuration,
				noAfkDuration
			});

			const systemPercentage = totalDuration > 0 ? (windowDuration - afkDuration) / totalDuration : 0;
			const mousePercentage = totalDuration > 0 ? afkDuration / totalDuration : 0;
			const keyboardPercentage = totalDuration > 0 ? noAfkDuration / totalDuration : 0;

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
}
