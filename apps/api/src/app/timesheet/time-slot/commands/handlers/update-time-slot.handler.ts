import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/models';
import { RequestContext } from 'apps/api/src/app/core/context';
import * as moment from 'moment';
import { Activity } from '../../../activity.entity';
import { UpdateTimeSlotCommand } from '../update-time-slot.command';
import { TimeSlot } from '../../../time-slot.entity';

@CommandHandler(UpdateTimeSlotCommand)
export class UpdateTimeSlotHandler
	implements ICommandHandler<UpdateTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>
	) {}

	public async execute(command: UpdateTimeSlotCommand): Promise<TimeSlot> {
		const { input, id } = command;

		let employeeId = input.employeeId;
		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			employeeId = user.employeeId;
		}

		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				...(employeeId ? { employeeId: employeeId } : {}),
				id: id
			}
		});

		if (timeSlot) {
			if (input.startedAt) {
				input.startedAt = moment(input.startedAt)
					//.set('minute', 0)
					.set('millisecond', 0)
					.toDate();
			}

			let newActivites = [];
			if (input.activites) {
				newActivites = input.activites.map((activity) => {
					activity = new Activity(activity);
					activity.employeeId = timeSlot.employeeId;
					return activity;
				});
				await this.activityRepository.save(newActivites);
				input.activites = (timeSlot.activites || []).concat(
					newActivites
				);
			}
			await this.timeSlotRepository.update(id, input);

			timeSlot = await this.timeSlotRepository.findOne(id, {
				relations: ['timeLogs', 'screenshots', 'activites']
			});
			return timeSlot;
		} else {
			return null;
		}
	}
}
