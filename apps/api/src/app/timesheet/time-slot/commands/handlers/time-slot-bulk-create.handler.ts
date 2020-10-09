import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotBulkCreateCommand } from '../time-slot-bulk-create.command';
import { RequestContext } from 'apps/api/src/app/core/context';
import { Employee } from 'apps/api/src/app/employee/employee.entity';

@CommandHandler(TimeSlotBulkCreateCommand)
export class TimeSlotBulkCreateHandler
	implements ICommandHandler<TimeSlotBulkCreateCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(
		command: TimeSlotBulkCreateCommand
	): Promise<TimeSlot[]> {
		let { slots } = command;

		if (slots.length === 0) {
			return [];
		}

		const insertedSlots = await this.timeSlotRepository.find({
			where: {
				startedAt: In(_.pluck(slots, 'startedAt'))
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

		let organizationId;
		if (!slots[0].organizationId) {
			const employee = await this.employeeRepository.findOne(
				slots[0].employeeId
			);
			organizationId = employee.organizationId;
		} else {
			organizationId = slots[0].organizationId;
		}

		slots = slots.map((slot) => {
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
		return slots;
	}
}
