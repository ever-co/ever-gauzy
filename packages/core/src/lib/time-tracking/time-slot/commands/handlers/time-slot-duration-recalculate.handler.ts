import { Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimeSlot } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from '../../../../core/context';
import { prepareSQLQuery as p } from '../../../../database/database.helper';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands';
import {
	ITimeSlotDurationRecalculateInput,
	TimeSlotDurationRecalculateCommand
} from '../time-slot-duration-recalculate.command';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { timeInTimeSlot } from '../../utils';

/** The most a time slot counts: its ten minutes. */
const TIME_SLOT_SECONDS = 600;

/** A time slot and the duration its time logs give it. */
interface RecalculatedTimeSlot {
	timeSlot: ITimeSlot;
	duration: number;
}

/**
 * The seconds the time logs holding a time slot spend in its ten minutes, at most those ten minutes.
 *
 * @param timeSlot - The time slot, with the time logs that hold it.
 */
function durationFromTimeLogs(timeSlot: ITimeSlot): number {
	let milliseconds = 0;
	for (const timeLog of timeSlot.timeLogs ?? []) {
		// A log with no stop counts until now, as TimeLog.afterEntityLoad counts its duration
		const stoppedAt = timeLog.stoppedAt ?? new Date();
		milliseconds += timeInTimeSlot(timeSlot, timeLog.startedAt, stoppedAt);
	}
	const seconds = Math.floor(milliseconds / 1000);
	return Math.min(seconds, TIME_SLOT_SECONDS);
}

@CommandHandler(TimeSlotDurationRecalculateCommand)
export class TimeSlotDurationRecalculateHandler implements ICommandHandler<TimeSlotDurationRecalculateCommand> {
	private readonly logger = new Logger(TimeSlotDurationRecalculateHandler.name);

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Sets each time slot's duration to the time the logs that still hold it spend in its ten minutes, and
	 * recalculates the timesheets of those logs when a duration changes. A failure is logged and not thrown: the
	 * time logs are saved by then, and only the totals of these slots are left as they were.
	 *
	 * @param command - The employee's time slots to recalculate.
	 */
	public async execute(command: TimeSlotDurationRecalculateCommand): Promise<void> {
		if (isEmpty(command.input.timeSlotsIds)) {
			return;
		}

		try {
			const timeSlots = await this.findTimeSlots(command.input);
			const recalculated = timeSlots.map((timeSlot) => ({ timeSlot, duration: durationFromTimeLogs(timeSlot) }));
			const changed = recalculated.filter(({ timeSlot, duration }) => duration !== timeSlot.duration);

			const saves = changed.map((recalculatedTimeSlot) => this.saveDuration(recalculatedTimeSlot));
			await Promise.all(saves);
			await this.recalculateTimesheets(changed);
		} catch (error) {
			this.logger.warn(`Error while recalculating time slot durations: ${error?.message ?? error}`, {
				stack: error?.stack
			});
		}
	}

	/**
	 * The employee's time slots with the given ids, each with the time logs that still hold it.
	 *
	 * @param input - The employee and the ids of the time slots.
	 */
	private async findTimeSlots(input: ITimeSlotDurationRecalculateInput): Promise<ITimeSlot[]> {
		const { organizationId, employeeId, timeSlotsIds } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
		query.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query
			.where(p(`"${query.alias}"."id" IN (:...timeSlotsIds)`), { timeSlotsIds })
			.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId })
			.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId })
			.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });

		return await query.getMany();
	}

	/**
	 * Saves a time slot's recalculated duration.
	 *
	 * @param recalculatedTimeSlot - The time slot and its duration.
	 */
	private async saveDuration({ timeSlot, duration }: RecalculatedTimeSlot): Promise<void> {
		await this.typeOrmTimeSlotRepository.update({ id: timeSlot.id, tenantId: timeSlot.tenantId }, { duration });
	}

	/**
	 * Recalculates once each timesheet of the time logs holding the changed time slots, whose totals sum the slots.
	 *
	 * @param changed - The time slots whose duration changed.
	 */
	private async recalculateTimesheets(changed: RecalculatedTimeSlot[]): Promise<void> {
		const timeLogs = changed.flatMap(({ timeSlot }) => timeSlot.timeLogs ?? []);
		const timesheetIds = timeLogs.map((timeLog) => timeLog.timesheetId);
		const knownTimesheetIds = timesheetIds.filter(Boolean);
		const uniqueTimesheetIds = [...new Set(knownTimesheetIds)];
		const recalculations = uniqueTimesheetIds.map((timesheetId) =>
			this.commandBus.execute(new TimesheetRecalculateCommand(timesheetId))
		);
		await Promise.all(recalculations);
	}
}
