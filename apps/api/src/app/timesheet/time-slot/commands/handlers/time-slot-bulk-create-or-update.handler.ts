import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotBulkCreateOrUpdateCommand } from '../time-slot-bulk-create-or-update.command';
import { RequestContext } from 'apps/api/src/app/core/context';
import { Employee } from 'apps/api/src/app/employee/employee.entity';

@CommandHandler(TimeSlotBulkCreateOrUpdateCommand)
export class TimeSlotBulkCreateOrUpdateHandler
	implements ICommandHandler<TimeSlotBulkCreateOrUpdateCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(
		command: TimeSlotBulkCreateOrUpdateCommand
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

		let organizationId;
		if (!slots[0].organizationId) {
			const employee = await this.employeeRepository.findOne(
				slots[0].employeeId
			);
			organizationId = employee.organizationId;
		} else {
			organizationId = slots[0].organizationId;
		}

		if (insertedSlots.length > 0) {
			slots = slots.map((slot) => {
				const oldSlot = insertedSlots.find(
					(insertedSlot) =>
						moment(insertedSlot.startedAt).format(
							'YYYY-MM-DD HH:mm'
						) === moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
				);

				if (oldSlot) {
					oldSlot.keyboard = slot.keyboard;
					oldSlot.mouse = slot.mouse;
					oldSlot.overall = slot.overall;
					return oldSlot;
				} else {
					if (!slot.organizationId) {
						slot.organizationId = organizationId;
					}
					slot.tenantId = RequestContext.currentTenantId();
					return slot;
				}
			});
		}
		await this.timeSlotRepository.save(slots);
		return slots;
	}
}
