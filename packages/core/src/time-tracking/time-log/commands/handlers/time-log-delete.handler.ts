import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { In, DeleteResult, UpdateResult } from 'typeorm';
import { chain, pluck } from 'underscore';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands/timesheet-recalculate.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeLog } from '../../time-log.entity';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { MikroOrmTimeLogRepository, TypeOrmTimeLogRepository } from '../../repository';

@CommandHandler(TimeLogDeleteCommand)
export class TimeLogDeleteHandler implements ICommandHandler<TimeLogDeleteCommand> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly _commandBus: CommandBus
	) {}

	/**
	 * Executes the TimeLogDeleteCommand to handle both soft and hard deletions of time logs,
	 * and ensures that associated time slots are deleted. It also recalculates relevant
	 * timesheet and employee worked hours based on the deleted time logs.
	 *
	 * This method performs the following operations:
	 * 1. Fetches the time logs based on the provided IDs.
	 * 2. Deletes associated time slots for each time log sequentially.
	 * 3. Soft deletes the time logs (or hard deletes them if `forceDelete` is true).
	 * 4. Recalculates timesheet and employee worked hours for the affected time logs.
	 *
	 * @param command - The TimeLogDeleteCommand containing the IDs or TimeLog objects to delete, along with the `forceDelete` flag.
	 * @returns A promise that resolves to a DeleteResult (for hard delete) or UpdateResult (for soft delete).
	 */
	public async execute(command: TimeLogDeleteCommand): Promise<DeleteResult | UpdateResult> {
		const { ids, forceDelete = false } = command;

		// Step 1: Fetch time logs based on the provided IDs
		const timeLogs = await this.fetchTimeLogs(ids);
		console.log('TimeLogs to be deleted:', timeLogs);

		// Step 2: Delete associated time slots for each time log sequentially
		await this.deleteTimeSlotsForLogs(timeLogs, forceDelete);

		// Step 3: Perform soft delete or hard delete based on the `forceDelete` flag
		const updateResult = await this.deleteTimeLogs(timeLogs, forceDelete);

		// Step 4: Recalculate timesheet and employee worked hours after deletion
		await this.recalculateTimesheetAndEmployeeHours(timeLogs);

		return updateResult;
	}

	/**
	 * Fetches time logs based on provided IDs or time log objects.
	 *
	 * @param ids - A string, array of strings, or TimeLog object(s).
	 * @returns A promise that resolves to an array of TimeLogs.
	 */
	private async fetchTimeLogs(ids: string | string[] | TimeLog | TimeLog[]): Promise<TimeLog[]> {
		if (typeof ids === 'string') {
			return await this.typeOrmTimeLogRepository.findBy({ id: ids });
		} else if (Array.isArray(ids) && typeof ids[0] === 'string') {
			return await this.typeOrmTimeLogRepository.findBy({ id: In(ids as string[]) });
		} else if (ids instanceof TimeLog) {
			return [ids];
		} else {
			return ids as TimeLog[];
		}
	}

	/**
	 * Deletes associated time slots for each time log sequentially.
	 *
	 * @param timeLogs - An array of time logs whose associated time slots will be deleted.
	 */
	private async deleteTimeSlotsForLogs(timeLogs: TimeLog[], forceDelete = false): Promise<void> {
		// Loop through each time log and delete its associated time slots
		for (const { employeeId, organizationId, timeSlots } of timeLogs) {
			const timeSlotsIds = pluck(timeSlots, 'id');

			// Delete time slots sequentially
			await this._commandBus.execute(
				new TimeSlotBulkDeleteCommand(
					{
						organizationId,
						employeeId,
						timeSlotsIds
					},
					forceDelete
				)
			);
		}
	}

	/**
	 * Deletes the provided time logs, either soft or hard depending on the `forceDelete` flag.
	 *
	 * If `forceDelete` is true, the time logs are permanently deleted. Otherwise, they are soft deleted.
	 * The method uses the TypeORM repository to perform the appropriate operation.
	 *
	 * @param timeLogs - An array of time logs to be deleted or soft deleted.
	 * @param forceDelete - A boolean flag indicating whether to force delete (hard delete) the time logs.
	 *                      Defaults to `false`, meaning soft delete is performed by default.
	 * @returns A promise that resolves to a DeleteResult (for hard delete) or UpdateResult (for soft delete).
	 */
	private async deleteTimeLogs(timeLogs: TimeLog[], forceDelete = false): Promise<DeleteResult | UpdateResult> {
		const logIds = pluck(timeLogs, 'id');

		// If force delete is true, perform a hard delete
		if (forceDelete) {
			return await this.typeOrmTimeLogRepository.delete({ id: In(logIds) });
		}

		// Otherwise, perform a soft delete
		return await this.typeOrmTimeLogRepository.softDelete({ id: In(logIds) });
	}

	/**
	 * Recalculates timesheet and employee worked hours for the deleted time logs.
	 *
	 * @param timeLogs - An array of time logs for which the recalculations will be made.
	 */
	private async recalculateTimesheetAndEmployeeHours(timeLogs: TimeLog[]): Promise<void> {
		try {
			// Recalculate timesheets
			const timesheetIds = chain(timeLogs).pluck('timesheetId').uniq().value();
			for (const timesheetId of timesheetIds) {
				await this._commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
			}

			// Recalculate employee worked hours
			const employeeIds = chain(timeLogs).pluck('employeeId').uniq().value();
			for (const employeeId of employeeIds) {
				await this._commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
			}
		} catch (error) {
			console.log('Error while recalculating timesheet and employee worked hours:', error);
		}
	}
}
