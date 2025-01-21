import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { isEmpty } from '@gauzy/common';
import { TimeSlot } from './../../time-slot.entity';
import { TimeSlotBulkCreateOrUpdateCommand } from './../time-slot-bulk-create-or-update.command';
import { RequestContext } from '../../../../core/context';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { TypeOrmTimeLogRepository } from '../../../time-log/repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository/type-orm-employee.repository';

@CommandHandler(TimeSlotBulkCreateOrUpdateCommand)
export class TimeSlotBulkCreateOrUpdateHandler implements ICommandHandler<TimeSlotBulkCreateOrUpdateCommand> {
	constructor(
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: TimeSlotBulkCreateOrUpdateCommand): Promise<TimeSlot[]> {
		let { slots, employeeId, organizationId } = command;
		if (slots.length === 0) {
			return [];
		}

		slots = slots.map((slot) => {
			slot.startedAt = moment.utc(slot.startedAt).toDate();
			return slot;
		});

		const insertedSlots = await this.typeOrmTimeSlotRepository.find({
			where: {
				startedAt: In(_.pluck(slots, 'startedAt'))
			},
			relations: ['timeLogs']
		});

		if (isEmpty(organizationId)) {
			const employee = await this.typeOrmEmployeeRepository.findOneBy({
				id: employeeId
			});
			organizationId = employee.organizationId;
		}

		const newSlotsTimeLogIds: any = _.chain(slots)
			.map((slot) => _.pluck(slot.timeLogs, 'id'))
			.flatten()
			.value();
		const oldSlotsTimeLogIds: any = _.chain(insertedSlots)
			.map((slot) => _.pluck(slot.timeLogs, 'id'))
			.flatten()
			.value();
		const timeLogIds = _.chain(oldSlotsTimeLogIds).concat(newSlotsTimeLogIds).uniq().values().value();

		const timeLogs = await this.typeOrmTimeLogRepository.find({
			where: {
				id: In(timeLogIds)
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.map((slot) => {
				const oldSlot = insertedSlots.find(
					(insertedSlot) =>
						moment(insertedSlot.startedAt).format('YYYY-MM-DD HH:mm') ===
						moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
				);

				if (oldSlot) {
					oldSlot.keyboard = oldSlot.keyboard + slot.keyboard;
					oldSlot.mouse = oldSlot.mouse + slot.mouse;
					oldSlot.overall = oldSlot.overall + slot.overall;
					const foundTimeLogs = _.where(timeLogs, {
						id: oldSlotsTimeLogIds
					});
					if (foundTimeLogs.length > 0) {
						oldSlot.timeLogs = oldSlot.timeLogs.concat(foundTimeLogs);
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
		await this.typeOrmTimeSlotRepository.save(slots);

		const dates = slots.map((slot) => moment.utc(slot.startedAt).toDate());
		const minDate = dates.reduce(function (a, b) {
			return a < b ? a : b;
		});
		const maxDate = dates.reduce(function (a, b) {
			return a > b ? a : b;
		});

		return await this.commandBus.execute(new TimeSlotMergeCommand(organizationId, employeeId, minDate, maxDate));
	}
}
