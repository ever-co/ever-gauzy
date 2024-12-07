import { ActivityWatchEventTableList, IActivityWatchEventService } from './i-activity-watch-event-service';
import { IDesktopEvent } from '../../interfaces';
import { ActivityWatchDAO } from './dao-layer';
import { ActivityWatchEventType } from '@gauzy/contracts';

export class ActivityWatchChromeService implements IActivityWatchEventService {
	private readonly chromeDAO: IActivityWatchEventService;

	constructor() {
		this.chromeDAO = new ActivityWatchDAO(ActivityWatchEventTableList.CHROME, ActivityWatchEventType.URL);
	}

	public find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		return this.chromeDAO.find(option);
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.chromeDAO.save(event);
	}

	public async clear(): Promise<void> {
		await this.chromeDAO.clear();
	}

	public async update(timeSlotId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void> {
		await this.chromeDAO.update(timeSlotId, eventIds);
	}
}
