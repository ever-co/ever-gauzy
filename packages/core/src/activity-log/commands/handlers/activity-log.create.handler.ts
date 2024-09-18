import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IActivityLog } from '@gauzy/contracts';
import { ActivityLogService } from '../../activity-log.service';
import { ActivityLogCreateCommand } from '../activity-log.create.command';

@CommandHandler(ActivityLogCreateCommand)
export class ActivityLogCreateHandler implements ICommandHandler<ActivityLogCreateCommand> {
	constructor(private readonly activityLogService: ActivityLogService) {}

	public async execute(command: ActivityLogCreateCommand): Promise<IActivityLog> {
		const { input } = command;
		return await this.activityLogService.create(input);
	}
}
