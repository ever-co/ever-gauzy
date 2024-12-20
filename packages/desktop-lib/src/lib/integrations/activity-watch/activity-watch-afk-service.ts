import { IActivityWatchEventService, IActivityWatchEventAfkCountService } from './i-activity-watch-event-service';
import { IDesktopEvent } from '../../interfaces';
import { ActivityWatchAfkDao } from './dao-layer';

export class ActivityWatchAfkService implements IActivityWatchEventService, IActivityWatchEventAfkCountService {
	private readonly afkDAO: ActivityWatchAfkDao;

	constructor() {
		this.afkDAO = new ActivityWatchAfkDao();
	}

	public find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		return this.afkDAO.find(option);
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.afkDAO.save(event);
	}

	public async clear(): Promise<void> {
		await this.afkDAO.clear();
	}

	public async update(timeSlotId: IDesktopEvent['timeSlotId'], eventIds: IDesktopEvent['eventId'][]): Promise<void> {
		await this.afkDAO.update(timeSlotId, eventIds);
	}

	public async duration(timerId: IDesktopEvent['timerId']): Promise<number> {
		return this.afkDAO.duration(timerId);
	}

	public async durationAfk(timerId: IDesktopEvent['timerId']): Promise<number> {
		return this.afkDAO.durationAfk(timerId);
	}

	public async durationNoAfk(timerId: IDesktopEvent['timerId']): Promise<number> {
		return this.afkDAO.durationNoAfk(timerId);
	}
}
