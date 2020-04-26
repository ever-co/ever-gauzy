import { Activity } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ActivityService } from '../../activity.service';
import { TimeSlotService } from '../../time-slot.service';
import { ActivityCreateCommand } from '..';

@CommandHandler(ActivityCreateCommand)
export class ActivityCreateHandler
	implements ICommandHandler<ActivityCreateCommand> {
	constructor(
		private readonly activityService: ActivityService,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: ActivityCreateCommand): Promise<Activity> {
		const { input } = command;
		const {
			employeeId,
			duration,
			keyboard,
			mouse,
			overall,
			startedAt,
			stoppedAt,
			title
		} = input;

		const timeSlot = await this.timeSlotService.create({
			employeeId,
			duration,
			keyboard,
			mouse,
			overall,
			startedAt,
			stoppedAt
		});

		return await this.activityService.create({
			title,
			timeSlotId: timeSlot.id
		});
	}
}
