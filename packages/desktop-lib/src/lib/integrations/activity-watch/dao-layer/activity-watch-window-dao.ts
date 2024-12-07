import { ActivityWatchEventTableList, IActivityWatchWindowEventCountService } from '../i-activity-watch-event-service';
import { ActivityWatchDAO } from './activity-watch.dao';
import { ActivityWatchEventType } from '@gauzy/contracts';
import { IDesktopEvent } from '../../../interfaces';

export class ActivityWatchWindowDAO extends ActivityWatchDAO implements IActivityWatchWindowEventCountService {
	constructor() {
		super(ActivityWatchEventTableList.WINDOW, ActivityWatchEventType.APP);
	}

	public async duration(timerId: IDesktopEvent['timerId']): Promise<number> {
		const result = await this.provider
			.connection<IDesktopEvent>(this.table)
			.where('timerId', timerId)
			.sum('duration as total')
			.first();

		return result ? Number(result['total']) : 0;
	}
}
