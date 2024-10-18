import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ActivityLogEvent } from '../activity-log.event';
import { ActivityLogService } from '../../activity-log.service';

@EventsHandler(ActivityLogEvent)
export class ActivityLogEventHandler implements IEventHandler<ActivityLogEvent> {
	constructor(readonly activityLogService: ActivityLogService) {}

	/**
	 * Handles the activity log event by creating a new activity log entry using the provided input data.
	 *
	 * @param event - The activity log event containing the input data required to create the log entry.
	 * @returns A promise that resolves with the created activity log entry.
	 *
	 */
	async handle(event: ActivityLogEvent) {
		// Extract the input from the event and create a new activity log entry
		return await this.activityLogService.create(event.input);
	}
}
