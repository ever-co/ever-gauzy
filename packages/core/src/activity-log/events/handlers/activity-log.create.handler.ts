import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ActivityLogCreateEvent } from '../activity-log.create.event';
import { ActivityLogService } from '../../../activity-log/activity-log.service';

@EventsHandler(ActivityLogCreateEvent)
export class ActivityLogEventHandler implements IEventHandler<ActivityLogCreateEvent> {
	constructor(private readonly activityLogService: ActivityLogService) {}

	async handle(event: ActivityLogCreateEvent) {
		const { input } = event;
		return await this.activityLogService.create(input);
	}
}
