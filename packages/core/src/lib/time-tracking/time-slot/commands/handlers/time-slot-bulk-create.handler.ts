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
		let { slots, employeeId, organizationId, tenantId } = command;
		if (slots.length === 0) {
			return [];
		}

		slots = slots.map((slot) => {
			const { start } = getDateRangeFormat(moment.utc(slot.startedAt), moment.utc(slot.startedAt));
			slot.startedAt = start as Date;
			return slot;
		});

		tenantId = tenantId || RequestContext.currentTenantId();

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
		// Every slot already exists — e.g. created a moment ago by an integration's slot mapping (Hubstaff), before
		// the time log that owns them. Nothing to insert, but they are still handed back, merged as below, so the
		// caller (TimeLogCreateHandler) links them to its log: an empty list left the log without slots, and the
		// reports that read a log's slots left it out.
		if (slots.length === 0) {
			return await this.mergeSlots(insertedSlots, organizationId, employeeId);
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

		if (slots.length > 0) {
			await this.typeOrmTimeSlotRepository.save(slots);
		}
		return await this.mergeSlots(insertedSlots.concat(slots), organizationId, employeeId);
	}

	/**
	 * Merges the employee's slots over the span the given slots cover and returns the result.
	 */
	private async mergeSlots(slots: TimeSlot[], organizationId: string, employeeId: string): Promise<TimeSlot[]> {
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
