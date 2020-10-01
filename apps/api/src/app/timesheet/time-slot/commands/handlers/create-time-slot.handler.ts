import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/models';
import { RequestContext } from 'apps/api/src/app/core/context';
import * as moment from 'moment';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { TimeSlot } from '../../../time-slot.entity';
import { TimeLog } from '../../../time-log.entity';
import * as _ from 'underscore';
import { BulkActivitesSaveCommand } from '../../../activity/commands/bulk-activites-save.command';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler
	implements ICommandHandler<CreateTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly commandBus: CommandBus
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

		if (!timeSlot) {
			timeSlot = new TimeSlot(_.omit(input, ['timeLogId']));
			// await this.timeSlotRepository.update(timeSlot.id, input);
		}

		if (input.timeLogId) {
			let timeLogIds = [];
			if (input.timeLogId instanceof Array) {
				timeLogIds = input.timeLogId;
			} else {
				timeLogIds = [input.timeLogId];
			}
			timeSlot.timeLogs = await this.timeLogRepository.find({
				id: In(timeLogIds)
			});
		}

		if (input.activities) {
			input.activities = await this.commandBus.execute(
				new BulkActivitesSaveCommand({
					employeeId: timeSlot.employeeId,
					projectId: timeSlot.timeLogs[0].projectId,
					activities: input.activities
				})
			);

			// input.activities = input.activities.map((activity) => {
			// 	activity = new Activity(activity);
			// 	activity.employeeId = timeSlot.employeeId;
			// 	return activity
			// });
			// timeSlot.activities = input.activities;
			// await this.activityRepository.save(timeSlot.activities);
		}
		timeSlot.tenantId = RequestContext.currentTenantId();
		await this.timeSlotRepository.save(timeSlot);

		timeSlot = await this.timeSlotRepository.findOne(timeSlot.id, {
			relations: ['timeLogs', 'screenshots']
		});
		return timeSlot;
	}
}
