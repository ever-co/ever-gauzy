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
			const { title, duration, type, timeSlot } = input;

			await this._timeSlotService.findOneOrFail({
				where: {
					startedAt: moment(timeSlot).format('YYYY-MM-DD HH:mm:ss')
				}
			});

			return await this._activityService.create({
				// TODO: add following fields:
				// - timeSlotId - not sure how to map it to Activity entity, maybe `date`?
				// - date - this should be a date when Activity happen
				// - data - not sure how to map it to Activity entity
				title,
				duration,
				type
			});
		} catch (error) {
			throw new BadRequestException('Cant create activity for time slot');
		}
	}
}
