import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
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
			const { title, duration, type, data, timeSlot } = input;

			const {
				record: timeSlotId
			} = await this._timeSlotService.findOneOrFail({
				where: {
					startedAt: moment(timeSlot).format('YYYY-MM-DD HH:mm:ss')
				}
			});

			return await this._activityService.create({
				timeSlotId,
				title,
				duration,
				type,
				data
			});
		} catch (error) {
			throw new BadRequestException('Cant create activity for time slot');
		}
	}
}
