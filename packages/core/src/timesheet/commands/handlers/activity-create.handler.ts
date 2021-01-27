import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ActivityCreateCommand } from '../activity-create.command';
import { ActivityService } from '../../activity/activity.service';

@CommandHandler(ActivityCreateCommand)
export class ActivityCreateHandler
	implements ICommandHandler<ActivityCreateCommand> {
	constructor(private _activityService: ActivityService) {}

	public async execute(command: ActivityCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const {
				title,
				duration,
				type,
				projectId,
				date,
				employeeId,
				taskId = null,
				organizationId
			} = input;

			return await this._activityService.create({
				title,
				duration,
				type,
				date,
				projectId,
				employeeId,
				taskId,
				organizationId
			});
		} catch (error) {
			throw new BadRequestException('Cant create activity for time slot');
		}
	}
}
