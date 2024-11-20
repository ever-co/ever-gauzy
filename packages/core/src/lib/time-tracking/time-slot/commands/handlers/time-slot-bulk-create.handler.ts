import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import * as moment from 'moment';
import { chain, pluck, where } from 'underscore';
import { TimeSlot } from './../../time-slot.entity';
import { TimeSlotBulkCreateCommand } from './../time-slot-bulk-create.command';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { RequestContext } from '../../../../core/context';
import { getDateRangeFormat } from './../../../../core/utils';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { TypeOrmTimeLogRepository } from '../../../time-log/repository/type-orm-time-log.repository';

@CommandHandler(TimeSlotBulkCreateCommand)
export class TimeSlotBulkCreateHandler implements ICommandHandler<TimeSlotBulkCreateCommand> {
	constructor(
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: TimeSlotBulkCreateCommand): Promise<TimeSlot[]> {
		let { slots, employeeId, organizationId } = command;
		if (slots.length === 0) {
			return [];
		}

		slots = slots.map((slot) => {
			const { start } = getDateRangeFormat(moment.utc(slot.startedAt), moment.utc(slot.startedAt));
			slot.startedAt = start as Date;
			return slot;
		});

		const tenantId = RequestContext.currentTenantId();
		const insertedSlots = await this.typeOrmTimeSlotRepository.find({
			where: {
				startedAt: In(pluck(slots, 'startedAt')),
				tenantId,
				organizationId,
				employeeId
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.filter(
				(slot) =>
					!insertedSlots.find((insertedSlot) => moment(insertedSlot.startedAt).isSame(moment(slot.startedAt)))
			);
		}
		if (slots.length === 0) {
			return [];
		}

		const timeLogs = await this.typeOrmTimeLogRepository.find({
			where: {
				id: In(chain(slots).pluck('timeLogId').flatten().value().filter(Boolean)),
				organizationId,
				employeeId,
				tenantId
			}
		});

		slots = slots.map((slot) => {
			let timeLogIds: any;
			if (slot.timeLogId instanceof Array) {
				timeLogIds = slot.timeLogId;
			} else {
				timeLogIds = [slot.timeLogId];
			}
			slot.timeLogs = [];
			for (const timeLogId of timeLogIds) {
				slot.timeLogs.push(...where(timeLogs, { id: timeLogId }));
			}
			slot.organizationId = organizationId;
			slot.tenantId = tenantId;
			return slot;
		});

		console.log('Time Slots Bulk Create Handler Request', { slots });

		if (slots.length > 0) {
			await this.typeOrmTimeSlotRepository.save(slots);
		}
		slots = insertedSlots.concat(slots);

		const dates = slots.map((slot) => moment(slot.startedAt).toDate());
		const minDate = dates.reduce(function (a, b) {
			return a < b ? a : b;
		});
		const maxDate = dates.reduce(function (a, b) {
			return a > b ? a : b;
		});
		return await this.commandBus.execute(new TimeSlotMergeCommand(organizationId, employeeId, minDate, maxDate));
	}
}
