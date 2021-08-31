import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { TimeSlot } from './../../time-slot.entity';
import { TimeSlotBulkCreateOrUpdateCommand } from './../time-slot-bulk-create-or-update.command';
import { RequestContext } from '../../../../core/context';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { Employee, TimeLog } from './../../../../core/entities/internal';

@CommandHandler(TimeSlotBulkCreateOrUpdateCommand)
export class TimeSlotBulkCreateOrUpdateHandler
	implements ICommandHandler<TimeSlotBulkCreateOrUpdateCommand> {
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
		command: TimeSlotBulkCreateOrUpdateCommand
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
				startedAt: In(_.pluck(slots, 'startedAt'))
			},
			relations: ['timeLogs']
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

		const newSlotsTimeLogIds: any = _.chain(slots)
			.map((slot) => _.pluck(slot.timeLogs, 'id'))
			.flatten()
			.value();
		const oldSlotsTimeLogIds: any = _.chain(insertedSlots)
			.map((slot) => _.pluck(slot.timeLogs, 'id'))
			.flatten()
			.value();
		const timeLogIds = _.chain(oldSlotsTimeLogIds)
			.concat(newSlotsTimeLogIds)
			.uniq()
			.values()
			.value();

		const timeLogs = await this.timeLogRepository.find({
			where: {
				id: In(timeLogIds)
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.map((slot) => {
				const oldSlot = insertedSlots.find(
					(insertedSlot) =>
						moment(insertedSlot.startedAt).format(
							'YYYY-MM-DD HH:mm'
						) === moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
				);

				if (oldSlot) {
					oldSlot.keyboard = oldSlot.keyboard + slot.keyboard;
					oldSlot.mouse = oldSlot.mouse + slot.mouse;
					oldSlot.overall = oldSlot.overall + slot.overall;
					const foundTimeLogs = _.where(timeLogs, {
						id: oldSlotsTimeLogIds
					});
					if (foundTimeLogs.length > 0) {
						oldSlot.timeLogs = oldSlot.timeLogs.concat(
							foundTimeLogs
						);
						oldSlot.timeLogs = _.uniq(oldSlot.timeLogs, 'id');
					}
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

		const dates = slots.map((slot) => moment.utc(slot.startedAt).toDate());
		const minDate = dates.reduce(function (a, b) {
			return a < b ? a : b;
		});
		const maxDate = dates.reduce(function (a, b) {
			return a > b ? a : b;
		});

		return await this.commandBus.execute(
			new TimeSlotMergeCommand(slots[0].employeeId, minDate, maxDate)
		);
	}
}
