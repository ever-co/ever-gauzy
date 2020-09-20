import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/models';
import { RequestContext } from 'apps/api/src/app/core/context';
import * as moment from 'moment';
import { Activity } from '../../../activity.entity';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { TimeSlot } from '../../../time-slot.entity';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler
	implements ICommandHandler<CreateTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>
	) {}

	public async execute(command: CreateTimeSlotCommand): Promise<TimeSlot> {
		const { input } = command;

		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			input.employeeId = user.employeeId;
		}

		input.startedAt = moment(input.startedAt)
			//.set('minute', 0)
			.set('millisecond', 0)
			.toDate();

		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				employeeId: input.employeeId,
				startedAt: input.startedAt
			}
		});

		if (timeSlot) {
			await this.timeSlotRepository.update(timeSlot.id, input);
		} else {
			timeSlot = new TimeSlot(input);
			if (input.activities) {
				input.activities = input.activities.map((activity) => {
					activity = new Activity(activity);
					activity.employeeId = timeSlot.employeeId;
					return activity;
				});
				timeSlot.activities = input.activities;
				await this.activityRepository.save(timeSlot.activities);
			}
			await this.timeSlotRepository.save(timeSlot);
		}

		timeSlot = await this.timeSlotRepository.findOne(timeSlot.id, {
			relations: ['timeLogs', 'screenshots', 'activities']
		});

		return timeSlot;
	}
}
