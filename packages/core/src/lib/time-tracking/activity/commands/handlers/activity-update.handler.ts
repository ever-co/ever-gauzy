import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IntegrationEntity } from '@gauzy/contracts';
import { ActivityUpdateCommand } from '../activity-update.command';
import { ActivityService } from './../../../activity/activity.service';

@CommandHandler(ActivityUpdateCommand)
export class ActivityUpdateHandler
	implements ICommandHandler<ActivityUpdateCommand> {

	constructor(
		private readonly _activityService: ActivityService
	) {}

	public async execute(command: ActivityUpdateCommand): Promise<any> {
		try {
			const { input } = command;
			const {
				id,
				title,
				duration,
				type,
				date,
				time,
				projectId,
				employeeId,
				taskId
			} = input;
			return await this._activityService.create({
				id,
				title,
				duration,
				type,
				date,
				time,
				projectId,
				employeeId,
				taskId
			});
		} catch (error) {
			throw new BadRequestException(error, `Can'\t update ${IntegrationEntity.ACTIVITY} for ${IntegrationEntity.TIME_SLOT}`);
		}
	}
}
