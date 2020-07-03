import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ActivityCreateCommand } from '../activity-create.command';
import { ActivityService } from '../../activity/activity.service';
import { TimeSlotService } from '../../time-slot/time-slot.service';

@CommandHandler(ActivityCreateCommand)
export class ActivityCreateHandler
	implements ICommandHandler<ActivityCreateCommand> {
	constructor(
		private _activityService: ActivityService,
		private _timeSlotService: TimeSlotService
	) {}

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
				taskId = null
			} = input;

			return await this._activityService.create({
				title,
				duration,
				type,
				date,
				projectId,
				employeeId,
				taskId
			});
		} catch (error) {
			throw new BadRequestException('Cant create activity for time slot');
		}
	}
}
