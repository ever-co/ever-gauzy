import { IActivityWatchEvent, IActivityWatchEventResult } from '@gauzy/contracts';
import { IDesktopEvent } from '../../interfaces';
import * as  moment from 'moment';

export class ActivityWatchEventAdapter {
	public static collections(activityWatchEventResult: IActivityWatchEventResult): IDesktopEvent[] {
		return activityWatchEventResult.event.map((event: IActivityWatchEvent) => {
			return {
				eventId: event.id,
				timerId: activityWatchEventResult.timerId,
				duration: event.duration,
				data: JSON.stringify(event.data),
				recordedAt: moment(event.timestamp).toISOString(),
				timeSlotId: null,
				type: activityWatchEventResult.type
			};
		});
	}
}
