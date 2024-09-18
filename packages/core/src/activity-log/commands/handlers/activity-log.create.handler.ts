import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { IActivityLog } from '@gauzy/contracts';
import { ActivityLogService } from '../../activity-log.service';
import { ActivityLogCreateEvent } from '../../events/activity-log.create.event';
import { ActivityLogCreateCommand } from '../activity-log.create.command';

@CommandHandler(ActivityLogCreateCommand)
export class ActivityLogCreateHandler implements ICommandHandler<ActivityLogCreateCommand> {
	constructor(private readonly activityLogService: ActivityLogService, private readonly eventBus: EventBus) {}

	public async execute(command: ActivityLogCreateCommand): Promise<IActivityLog> {
		const { input } = command;
		const activityLog = await this.activityLogService.create(input);

		this.eventBus.publish(new ActivityLogCreateEvent(input));

		return activityLog;
	}
}
