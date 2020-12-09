import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotBulkCreateCommand } from '../time-slot-bulk-create.command';
import { RequestContext } from 'apps/api/src/app/core/context';
import { Employee } from 'apps/api/src/app/employee/employee.entity';
import { TimeLog } from '../../../time-log.entity';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';

@CommandHandler(TimeSlotBulkCreateCommand)
export class TimeSlotBulkCreateHandler
	implements ICommandHandler<TimeSlotBulkCreateCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: TimeSlotBulkCreateCommand
	): Promise<TimeSlot[]> {
		let { slots } = command;

		if (slots.length === 0) {
			return [];
		}

		slots = slots.map((slot) => {
			slot.startedAt = moment.utc(slot.startedAt).toDate();
			return slot;
		});

		const insertedSlots = await this.timeSlotRepository.find({
			where: {
				startedAt: In(_.pluck(slots, 'startedAt')),
				...(slots[0].employeeId
					? { employeeId: slots[0].employeeId }
					: {})
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.filter(
				(slot) =>
					!insertedSlots.find(
						(insertedSlot) =>
							moment(insertedSlot.startedAt).format(
								'YYYY-MM-DD HH:mm'
							) ===
							moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
					)
			);
		}

		if (slots.length === 0) {
			return [];
		}

		let organizationId;
		if (!slots[0].organizationId) {
			const employee = await this.employeeRepository.findOne(
				slots[0].employeeId
			);
			organizationId = employee.organizationId;
		} else {
			organizationId = slots[0].organizationId;
		}

		const timeLogs = await this.timeLogRepository.find({
			where: {
				id: In(_.chain(slots).pluck('timeLogId').flatten().value())
			}
		});

		slots = slots.map((slot) => {
			let timeLogIds: any;
			if (slot.timeLogId instanceof Array) {
				timeLogIds = slot.timeLogId;
			} else {
				timeLogIds = [slot.timeLogId];
			}
			slot.timeLogs = _.where(timeLogs, { id: timeLogIds });

			if (!slot.organizationId) {
				slot.organizationId = organizationId;
			}
			slot.tenantId = RequestContext.currentTenantId();
			return slot;
		});

		if (slots.length > 0) {
			await this.timeSlotRepository.save(slots);
		}
		slots = insertedSlots.concat(slots);

		const dates = slots.map((slot) => moment(slot.startedAt).toDate());
		const mnDate = dates.reduce(function (a, b) {
			return a < b ? a : b;
		});
		const mxDate = dates.reduce(function (a, b) {
			return a > b ? a : b;
		});
		return await this.commandBus.execute(
			new TimeSlotMergeCommand(slots[0].employeeId, mnDate, mxDate)
		);
	}
}
