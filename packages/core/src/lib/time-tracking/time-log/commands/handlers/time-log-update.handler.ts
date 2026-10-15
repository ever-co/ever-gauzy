import { Logger, NotFoundException } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { ID, ITimeLog, ITimeSlot, ITimesheet, TimeLogSourceEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands/time-slot-bulk-delete.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { RequestContext } from './../../../../core/context';
import { debugInDevelopment } from './../../../../logger';
import { MultiORM, MultiORMEnum, getORMType } from './../../../../core/utils';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../../../time-slot/repository/mikro-orm-time-slot.repository';

/**
 * Input keys that decide WHERE a time log lives. They are never taken from the input.
 */
const TIME_LOG_SCOPE_FIELDS = ['id', 'tenantId', 'tenant', 'organizationId', 'organization', 'employee'] as const;

/**
 * Returns a copy of the input without the scope fields.
 *
 * @param input - The requested time log changes.
 */
export function omitScopeFields<T extends object>(input: T): Partial<T> {
	const changes: Partial<T> = { ...input };
	for (const field of TIME_LOG_SCOPE_FIELDS) {
		delete (changes as any)[field];
	}
	return changes;
}

@CommandHandler(TimeLogUpdateCommand)
export class TimeLogUpdateHandler implements ICommandHandler<TimeLogUpdateCommand> {
	protected ormType: MultiORM = getORMType();
	private readonly logger = new Logger(TimeLogUpdateHandler.name);

	constructor(
		private readonly commandBus: CommandBus,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		private readonly timeSlotService: TimeSlotService
	) {}

	/**
	 * Updates a time log, manages associated time slots, and recalculates timesheet and employee hours.
	 *
	 * This method retrieves the time log, updates its details, and handles time slot conflicts if the start or stop time is modified.
	 * It creates new time slots if necessary, saves the updated time log, and recalculates the timesheet and employee hours.
	 *
	 * @param command - The command containing the time log update data, including options for force delete and manual time slots.
	 * @returns A promise that resolves to the updated `TimeLog`.
	 */

	public async execute(command: TimeLogUpdateCommand): Promise<ITimeLog> {
		// Extract input parameters from the command
		const { id, input, manualTimeSlot, forceDelete = false } = command;

		let timeLog: ITimeLog = await this.getTimeLogByIdOrInstance(id);

		// Tenant and organization always come from the stored row, never from the input: the input is
		// (partly) a request body, and spreading its tenantId/organizationId into the update re-pointed
		// the log at another tenant (GHSA-6qvm-3wg4-26w4).
		const { employeeId: previousEmployeeId, organizationId, tenantId, timesheetId: previousTimesheetId } = timeLog;
		debugInDevelopment(this.logger, () => `Tenant ID: ${tenantId}`);
		const changes = omitScopeFields(input);

		// The employee the log belongs to once updated. `employeeId` is not a scope field: the manual-time update
		// moves a log to another employee of the SAME organization (`TimeLogService.updateManualTime` refuses any
		// other, and any log with tracked screenshots or activity), and what the log owns moves with it — its
		// timesheet, its time slots and the worked hours of both employees.
		const employeeId: ID = changes.employeeId ?? previousEmployeeId;
		const moved = String(employeeId) !== String(previousEmployeeId);

		let timesheet: ITimesheet;
		let updateTimeSlots: ITimeSlot[] = [];

		// Check if time slots need to be updated
		let needToUpdateTimeSlots = Boolean(input.startedAt || input.stoppedAt) || moved;
		debugInDevelopment(this.logger, () => `Need to update time slots: ${needToUpdateTimeSlots}`);

		if (needToUpdateTimeSlots) {
			// Generate time slots based on the updated time log details
			const { startedAt, stoppedAt } = { ...timeLog, ...changes };

			// The timesheet of the employee the log now belongs to, for the log's period.
			timesheet = await this.commandBus.execute(
				new TimesheetFirstOrCreateCommand(moved ? startedAt : input.startedAt, employeeId, organizationId)
			);

			updateTimeSlots = this.timeSlotService.generateTimeSlots(startedAt, stoppedAt);
		}

		// Update the time log in the repository
		await this.typeOrmTimeLogRepository.update(
			{ id: timeLog.id, tenantId },
			{
				...changes,
				...(timesheet ? { timesheetId: timesheet.id } : {})
			}
		);

		// Regenerate the existing time slots for the time log
		const timeSlots = this.timeSlotService.generateTimeSlots(timeLog.startedAt, timeLog.stoppedAt);

		// Retrieve the updated time log
		timeLog = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id });

		// Check if time slots need to be updated
		if (needToUpdateTimeSlots) {
			if (moved) {
				// A moved log leaves the previous employee as deleting it would: the slots only it held go, a slot
				// another of their logs still holds stays theirs.
				await this.releaseSlotsOfMovedLog(
					timeLog,
					tenantId,
					organizationId,
					previousEmployeeId,
					timeSlots,
					forceDelete
				);
			} else {
				// Identify conflicting start times
				const startTimes = this.getConflictingStartTimes(timeSlots, updateTimeSlots);

				// Remove conflicting time slots
				if (startTimes.length > 0) {
					await this.removeConflictingTimeSlots(
						tenantId,
						organizationId,
						employeeId,
						startTimes,
						forceDelete
					);
				}
			}
			// Create new time slots if needed for Web Timer, and for a moved log under its new employee. The answer
			// is every slot of the employee at those starts — the ones created and the ones they already had there
			// (another of their logs may share a ten-minute slot) — and, as TimeLogCreateHandler does, it becomes
			// the log's slots, so the save below links the log to each of them, an existing slot included.
			if (moved || (!manualTimeSlot && timeLog.source === TimeLogSourceEnum.WEB_TIMER)) {
				timeLog.timeSlots = await this.bulkCreateTimeSlots(
					updateTimeSlots,
					timeLog,
					employeeId,
					organizationId,
					tenantId
				);
			}

			// Update the time log in the repository
			await this.saveUpdatedTimeLog(timeLog);

			// Recalculate timesheets and employee hours
			await this.recalculateTimesheetAndEmployeeHours(timeLog.timesheetId, employeeId);
			debugInDevelopment(
				this.logger,
				() => `Recalculated timesheets and employee hours: ${timeLog.timesheetId}, ${employeeId}`
			);

			// The previous employee's timesheet and worked hours lose the moved log.
			if (moved) {
				await this.recalculateTimesheetAndEmployeeHours(
					String(previousTimesheetId ?? '') !== String(timeLog.timesheetId ?? '')
						? previousTimesheetId
						: undefined,
					previousEmployeeId
				);
			}
		}

		// Return the updated time log
		const updatedTimeLog = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id });

		return updatedTimeLog;
	}

	/**
	 * Retrieves a time log by its ID or directly returns the instance if provided.
	 *
	 * If the `id` parameter is already a `TimeLog` instance, it is returned as is. Otherwise, it fetches
	 * the time log from the repository using the provided `id`.
	 *
	 * @param id - The time log ID or an instance of `TimeLog`.
	 * @returns A promise that resolves to the `ITimeLog` instance.
	 */
	private async getTimeLogByIdOrInstance(id: ID | TimeLog): Promise<ITimeLog> {
		if (id instanceof TimeLog) {
			return id;
		}
		// An id is resolved inside the caller's tenant only (the raw repository has no tenant scoping).
		const tenantId = RequestContext.currentTenantId();
		const timeLog = tenantId ? await this.typeOrmTimeLogRepository.findOneBy({ id, tenantId }) : null;
		if (!timeLog) {
			throw new NotFoundException('The time log was not found');
		}
		return timeLog;
	}

	/**
	 * Identifies the conflicting start times that need to be removed from time slots.
	 *
	 * This method filters out time slots that have matching `startedAt` times in the new slots and returns
	 * the start times of the slots that need to be removed.
	 *
	 * @param slots - The existing time slots.
	 * @param newSlots - The newly generated time slots.
	 * @returns An array of conflicting start times that need to be removed.
	 */
	private getConflictingStartTimes(slots: ITimeSlot[], newSlots: ITimeSlot[]): Date[] {
		return slots
			.filter(
				(existingSlot) => !newSlots.some((newSlot) => moment(newSlot.startedAt).isSame(existingSlot.startedAt))
			)
			.map((slot) => new Date(slot.startedAt));
	}

	/**
	 * Removes or soft deletes conflicting time slots for a given employee within the specified time range.
	 *
	 * If `forceDelete` is true, the conflicting time slots will be hard deleted. Otherwise, they will be soft deleted.
	 *
	 * @param params - An object containing `tenantId`, `organizationId`, `employeeId`, and `startTimes`.
	 * @param forceDelete - A boolean flag indicating whether to perform a hard delete (`true`) or a soft delete (`false`).
	 * @returns A promise that resolves after the time slots have been deleted or soft deleted.
	 */
	private async removeConflictingTimeSlots(
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		startTimes: Date[],
		forceDelete: boolean
	): Promise<ITimeSlot | ITimeSlot[]> {
		const slots = await this.findTimeSlots(tenantId, organizationId, employeeId, startTimes);

		debugInDevelopment(
			this.logger,
			() => `conflicting time slots for ${forceDelete ? 'hard' : 'soft'} deleting: ${slots.length}`
		);

		if (isEmpty(slots)) {
			return [];
		}

		// Delete or soft delete the conflicting time slots
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const em = this.mikroOrmTimeSlotRepository.getEntityManager();
				if (forceDelete) {
					await em.removeAndFlush(slots);
				} else {
					for (const slot of slots) {
						(slot as any).deletedAt = new Date();
					}
					await em.persistAndFlush(slots);
				}
				return slots;
			}
			case MultiORMEnum.TypeORM:
			default:
				return forceDelete
					? this.typeOrmTimeSlotRepository.remove(slots)
					: this.typeOrmTimeSlotRepository.softRemove(slots);
		}
	}

	/**
	 * Releases the previous employee's time slots of a log that moves to another employee.
	 *
	 * The previous employee is left exactly as deleting the log would leave them: the log's slots go through the
	 * slot cleanup of `TimeLogDeleteHandler` (`TimeSlotBulkDeleteCommand`), which removes a slot only this log holds
	 * and keeps a slot another of their logs still holds — two logs that meet inside one ten-minute slot share it —
	 * so their timesheet keeps every minute that did not move. The log's link to a slot it shared is dropped when the
	 * log is saved with its new employee's slots.
	 *
	 * @param timeLog - The moving log.
	 * @param tenantId - The log's tenant.
	 * @param organizationId - The log's organization.
	 * @param previousEmployeeId - The employee the log leaves.
	 * @param previousSlots - The slots of the log's range before the update.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`) the slots that go.
	 */
	private async releaseSlotsOfMovedLog(
		timeLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		previousEmployeeId: ID,
		previousSlots: ITimeSlot[],
		forceDelete: boolean
	): Promise<void> {
		const startTimes = previousSlots.map((slot) => new Date(slot.startedAt));
		// A length check, not `isEmpty`: that helper reads a Date as an empty object, so a list of dates as empty.
		if (startTimes.length === 0) {
			return;
		}

		const timeSlotsIds = (await this.findTimeSlots(tenantId, organizationId, previousEmployeeId, startTimes))
			.filter((slot) => (slot.timeLogs ?? []).some((log) => log.id === timeLog.id))
			.map((slot) => slot.id);
		if (isEmpty(timeSlotsIds)) {
			return;
		}

		await this.commandBus.execute(
			new TimeSlotBulkDeleteCommand(
				{ organizationId, employeeId: previousEmployeeId, timeLog, timeSlotsIds, tenantId },
				forceDelete
			)
		);
	}

	/**
	 * The time slots of an employee at the given start times, with their time logs, screenshots, activities and
	 * minute records.
	 *
	 * @param tenantId - The tenant.
	 * @param organizationId - The organization.
	 * @param employeeId - The employee.
	 * @param startTimes - The slot start times.
	 * @returns The slots found.
	 */
	private async findTimeSlots(
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		startTimes: Date[]
	): Promise<ITimeSlot[]> {
		let slots: ITimeSlot[] = [];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const em = this.mikroOrmTimeSlotRepository.getEntityManager();
				slots = await em.find('TimeSlot', {
					organizationId,
					tenantId,
					employeeId,
					startedAt: { $in: startTimes }
				} as any, {
					populate: ['timeLogs', 'screenshots', 'activities', 'timeSlotMinutes']
				}) as any[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Query to fetch conflicting time slots
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

				// Add joins to the query
				query
					.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs')
					.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots')
					.leftJoinAndSelect(`${query.alias}.activities`, 'activities')
					.leftJoinAndSelect(`${query.alias}.timeSlotMinutes`, 'timeSlotMinutes');

				// Add where clauses to the query
				query
					.where(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId })
					.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId })
					.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId })
					.andWhere(p(`"${query.alias}"."startedAt" IN (:...startTimes)`), { startTimes });

				// Get the conflicting time slots
				slots = await query.getMany();
				break;
			}
		}

		return slots;
	}

	/**
	 * Bulk creates time slots for a given time log.
	 *
	 * This method enriches the provided time slots by adding additional fields like `employeeId`, `organizationId`,
	 * `tenantId`, and `timeLogId`, along with initializing `keyboard`, `mouse`, and `overall` activity metrics to zero.
	 * It filters out any slots that do not have valid `tenantId` or `organizationId` values and then performs a bulk creation of time slots.
	 *
	 * @param updateTimeSlots - The array of time slots that need to be enriched and created.
	 * @param timeLog - The time log associated with the time slots.
	 * @param employeeId - The ID of the employee associated with the time slots.
	 * @param organizationId - The ID of the organization associated with the time slots.
	 * @param tenantId - The tenant ID associated with the time slots.
	 * @returns A promise that resolves to an array of created time slots.
	 */
	private async bulkCreateTimeSlots(
		updateTimeSlots: ITimeSlot[],
		timeLog: ITimeLog,
		employeeId: ID,
		organizationId: ID,
		tenantId: ID
	): Promise<ITimeSlot[]> {
		const slots = updateTimeSlots
			.map((slot) => ({
				...slot,
				employeeId,
				organizationId,
				tenantId,
				keyboard: 0,
				mouse: 0,
				overall: 0,
				timeLogId: timeLog.id
			}))
			.filter((slot) => slot.tenantId && slot.organizationId); // Filter slots with valid tenant and organization IDs

		// Assign regenerated TimeSlot entries for existed TimeLog
		return await this.timeSlotService.bulkCreate(slots, employeeId, organizationId);
	}

	/**
	 * Saves the updated time log to the repository.
	 *
	 * @param timeLog - The time log to be saved.
	 * @returns A promise that resolves to the saved `ITimeLog` or throws an error if saving fails.
	 */
	private async saveUpdatedTimeLog(timeLog: ITimeLog): Promise<ITimeLog> {
		try {
			return await this.typeOrmTimeLogRepository.save(timeLog);
		} catch (error) {
			console.log('Failed to update the time log at line: 217', error);
		}
	}

	/**
	 * Recalculates the timesheet activities and updates the employee's total worked hours.
	 *
	 * This method first recalculates the total activity for the given timesheet by executing the
	 * `TimesheetRecalculateCommand`. Then, if an `employeeId` is provided, it updates the total
	 * worked hours for that employee by executing the `UpdateEmployeeTotalWorkedHoursCommand`.
	 *
	 * @param timesheetId - The ID of the timesheet for which the activity needs to be recalculated; none is recalculated without one.
	 * @param employeeId - The ID of the employee whose total worked hours should be updated. If `null` or `undefined`, no update will be performed for the employee.
	 * @returns A promise that resolves when both recalculation operations are complete.
	 */

	private async recalculateTimesheetAndEmployeeHours(timesheetId: ID | undefined, employeeId: ID): Promise<void> {
		// Recalculate timesheets (none to recalculate without one: a moved log's previous employee may keep the same)
		if (timesheetId) {
			await this.commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
		}

		// Update employee total worked hours
		if (employeeId) {
			await this.commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
		}
	}
}
