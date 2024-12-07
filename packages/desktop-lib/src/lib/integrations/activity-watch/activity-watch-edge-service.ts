import { ActivityWatchEventTableList, IActivityWatchEventService } from './i-activity-watch-event-service';
import { IDesktopEvent } from '../../interfaces';
import { ActivityWatchDAO } from './dao-layer';
import { ActivityWatchEventType } from '@gauzy/contracts';

export class ActivityWatchEdgeService implements IActivityWatchEventService {
	private readonly edgeDAO: IActivityWatchEventService;

	constructor() {
		this.edgeDAO = new ActivityWatchDAO(ActivityWatchEventTableList.EDGE, ActivityWatchEventType.URL);
	}

	public find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		return this.edgeDAO.find(option);
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.edgeDAO.save(event);
	}

	public async clear(): Promise<void> {
		await this.edgeDAO.clear();
	}

	public async update(timeSlotId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void> {
		await this.edgeDAO.update(timeSlotId, eventIds);
	}
}
