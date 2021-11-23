import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import { ActivityCreateCommand } from '../activity-create.command';
import { ActivityService } from './../../../activity/activity.service';
import { TimeSlotService } from './../../../time-slot/time-slot.service';

@CommandHandler(ActivityCreateCommand)
export class ActivityCreateHandler
	implements ICommandHandler<ActivityCreateCommand> {

	constructor(
		private readonly _activityService: ActivityService,
		private readonly _timeSlotService: TimeSlotService
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
				time,
				employeeId,
				taskId,
				organizationId,
				activityTimestamp
			} = input;

			let {
				record: timeSlot
			} = await this._timeSlotService.findOneOrFailByOptions({
				where: {
					employeeId,
					organizationId,
					startedAt: new Date(moment(activityTimestamp).format('YYYY-MM-DD HH:mm:ss'))
				}
			});

			//if timeslot not found for this screenshot then create new timeslot
			if (!timeSlot) {
				timeSlot = await this._timeSlotService.create({
					organizationId,
					employeeId,
					duration: 600,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: new Date(
						moment(activityTimestamp).format('YYYY-MM-DD HH:mm:ss')
					)
				});
			}

			return await this._activityService.create({
				title,
				duration,
				type,
				date,
				time,
				projectId,
				employeeId,
				taskId,
				organizationId,
				timeSlot
			});
		} catch (error) {
			throw new BadRequestException('Cant create activity for time slot');
		}
	}
}
