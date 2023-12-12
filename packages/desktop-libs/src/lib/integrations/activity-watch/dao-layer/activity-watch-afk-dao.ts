import { ActivityWatchDAO } from './activity-watch.dao';
import { ActivityWatchEventTableList, IActivityWatchEventAfkCountService } from '../i-activity-watch-event-service';
import { ActivityWatchEventType, ActivityWatchAfkEventStatus } from '@gauzy/contracts';
import { IDesktopEvent } from '../../../interfaces';

export class ActivityWatchAfkDao extends ActivityWatchDAO implements IActivityWatchEventAfkCountService {
	constructor() {
		super(ActivityWatchEventTableList.AFK, ActivityWatchEventType.AFK);
	}

	public async duration(timerId: IDesktopEvent['timerId']): Promise<number> {
		const result = await this.provider
			.connection<IDesktopEvent>(this.table)
			.where('timerId', timerId)
			.sum('duration as total')
			.first();

		return result ? Number(result['total']) : 0;
	}

	public async durationAfk(timerId: IDesktopEvent['timerId']): Promise<number> {
		const result = await this.provider
			.connection<IDesktopEvent>(this.table)
			.where('timerId', timerId)
			.whereJsonPath('data', '$.status', '=', ActivityWatchAfkEventStatus.AFK)
			.sum('duration as total')
			.first();

		return result ? Number(result['total']) : 0;
	}

	public async durationNoAfk(timerId: IDesktopEvent['timerId']): Promise<number> {
		const result = await this.provider
			.connection<IDesktopEvent>(this.table)
			.where('timerId', timerId)
			.whereJsonPath('data', '$.status', '=', ActivityWatchAfkEventStatus.NO_AFK)
			.sum('duration as total')
			.first();

		return result ? Number(result['total']) : 0;
	}
}
