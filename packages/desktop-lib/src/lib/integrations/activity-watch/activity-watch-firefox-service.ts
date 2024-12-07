import { ActivityWatchEventTableList, IActivityWatchEventService } from './i-activity-watch-event-service';
import { IDesktopEvent } from '../../interfaces';
import { ActivityWatchDAO } from './dao-layer';
import { ActivityWatchEventType } from '@gauzy/contracts';

export class ActivityWatchFirefoxService implements IActivityWatchEventService {
	private readonly firefoxDAO: IActivityWatchEventService;

	constructor() {
		this.firefoxDAO = new ActivityWatchDAO(ActivityWatchEventTableList.FIREFOX, ActivityWatchEventType.URL);
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.firefoxDAO.save(event);
	}

	public async clear(): Promise<void> {
		await this.firefoxDAO.clear();
	}

	public async update(timeSlotId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void> {
		await this.firefoxDAO.update(timeSlotId, eventIds);
	}

	public find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		return this.firefoxDAO.find(option);
	}
}
