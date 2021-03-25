import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { TimeSlot } from '../../../time-slot.entity';
import { TimeLog } from '../../../time-log.entity';
import { Employee } from '../../../../employee/employee.entity';
import { BulkActivitiesSaveCommand } from '../../../activity/commands/bulk-activities-save.command';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';

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
		const { startedAt } = input;

		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			input.employeeId = user.employeeId;
		}
		input.startedAt = moment(startedAt).set('millisecond', 0).toDate();

		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				employeeId: input.employeeId,
				startedAt: input.startedAt
			}
		});

		if (!timeSlot) {
			timeSlot = new TimeSlot(_.omit(input, ['timeLogId']));
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
			timeSlot.activities = await this.commandBus.execute(
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

		await this.timeSlotRepository.save(timeSlot);

		const slots = [timeSlot];
		const dates = slots.map((slot) => moment.utc(slot.startedAt).toDate());

		const minDate = dates.reduce(function (a, b) {
			return a < b ? a : b;
		});
		const maxDate = dates.reduce(function (a, b) {
			return a > b ? a : b;
		});

		let [createdTimeSlot] = await this.commandBus.execute(
			new TimeSlotMergeCommand(timeSlot.employeeId, minDate, maxDate)
		);

		console.log('Create Time Slot:', { timeSlot: createdTimeSlot });

		createdTimeSlot = await this.timeSlotRepository.findOne(
			createdTimeSlot.id,
			{
				relations: ['timeLogs', 'screenshots']
			}
		);
		return createdTimeSlot;
	}
}
