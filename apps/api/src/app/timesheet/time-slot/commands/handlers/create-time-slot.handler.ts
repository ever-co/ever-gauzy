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
import { Employee } from 'apps/api/src/app/employee/employee.entity';
import { BulkActivitiesSaveCommand } from '../../../activity/commands/bulk-activities-save.command';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler
	implements ICommandHandler<CreateTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
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
		} else {
			timeSlot.timeLogs = await this.timeLogRepository
				.createQueryBuilder()
				.where(`:startedAt BETWEEN "startedAt" AND "stoppedAt"`, {
					startedAt: timeSlot.startedAt
				})
				.orWhere('"startedAt" <= :startedAt AND "stoppedAt" IS NULL', {
					startedAt: timeSlot.startedAt
				})
				.getMany();
		}

		if (input.activities) {
			input.activities = await this.commandBus.execute(
				new BulkActivitiesSaveCommand({
					employeeId: timeSlot.employeeId,
					projectId:
						timeSlot.timeLogs && timeSlot.timeLogs.length > 0
							? timeSlot.timeLogs[0].projectId
							: null,
					activities: input.activities
				})
			);
		}
		timeSlot.tenantId = RequestContext.currentTenantId();
		if (!timeSlot.organizationId) {
			const employee = await this.employeeRepository.findOne(
				input.employeeId
			);
			timeSlot.organizationId = employee.organizationId;
		}

		console.log({ timeSlot });

		await this.timeSlotRepository.save(timeSlot);

		timeSlot = await this.timeSlotRepository.findOne(timeSlot.id, {
			relations: ['timeLogs', 'screenshots']
		});
		return timeSlot;
	}
}
