import { IActivityWatchEventService } from './i-activity-watch-event-service';
import { IDesktopEvent } from '../../interfaces';
import { ActivityWatchWindowDAO } from './dao-layer';

export class ActivityWatchWindowService implements IActivityWatchEventService {
	private readonly windowsDAO: ActivityWatchWindowDAO;

	constructor() {
		this.windowsDAO = new ActivityWatchWindowDAO();
	}

	public find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		return this.windowsDAO.find(option);
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.windowsDAO.save(event);
	}

	public async clear(): Promise<void> {
		await this.windowsDAO.clear();
	}

	public async update(timeSlotId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void> {
		await this.windowsDAO.update(timeSlotId, eventIds);
	}

	public async duration(timerId: IDesktopEvent['timerId']): Promise<number> {
		return this.windowsDAO.duration(timerId);
	}
}
