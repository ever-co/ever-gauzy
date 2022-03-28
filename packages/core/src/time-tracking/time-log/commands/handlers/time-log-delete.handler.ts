import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeleteResult, UpdateResult } from 'typeorm';
import { chain, pluck } from 'underscore';
import { TimeLog } from './../../time-log.entity';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands/timesheet-recalculate.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { TimeSlotBulkDeleteCommand } from './../../../time-slot/commands';

@CommandHandler(TimeLogDeleteCommand)
export class TimeLogDeleteHandler
	implements ICommandHandler<TimeLogDeleteCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: TimeLogDeleteCommand
	): Promise<DeleteResult | UpdateResult> {
		const { ids, forceDelete } = command;

		let timeLogs: TimeLog[];
		if (typeof ids === 'string') {
			timeLogs = await this.timeLogRepository.find({ id: ids });
		} else if (ids instanceof Array && typeof ids[0] === 'string') {
			timeLogs = await this.timeLogRepository.find({
				id: In(ids as string[])
			});
		} else if (ids instanceof TimeLog) {
			timeLogs = [ids];
		} else {
			timeLogs = ids as TimeLog[];
		}
		console.log('TimeLog will be delete:', timeLogs);

		for await (const timeLog of timeLogs) {
			const { employeeId, organizationId, timeSlots } = timeLog;
			const timeSlotsIds = pluck(timeSlots, 'id');
			await this.commandBus.execute(
				new TimeSlotBulkDeleteCommand({
					organizationId,
					employeeId,
					timeLog,
					timeSlotsIds
				})
			);
		}

		let deleteResult: DeleteResult | UpdateResult;
		if (forceDelete) {
			deleteResult = await this.timeLogRepository.delete({
				id: In(pluck(timeLogs, 'id'))
			});
		} else {
			deleteResult = await this.timeLogRepository.update(
				{ id: In(pluck(timeLogs, 'id')) },
				{ deletedAt: new Date() }
			);
		}

		try {
			/**
			 * Timesheet Recalculate Command
			 */
			const timesheetIds = chain(timeLogs).pluck('timesheetId').uniq().value();
			for await (const timesheetId of timesheetIds) {
				await this.commandBus.execute(
					new TimesheetRecalculateCommand(timesheetId)
				);
			}

			/**
			 * Employee Worked Hours Recalculate Command
			 */
			const employeeIds = chain(timeLogs).pluck('employeeId').uniq().value();
			for await (const employeeId of employeeIds) {
				await this.commandBus.execute(
					new UpdateEmployeeTotalWorkedHoursCommand(employeeId)
				);
			}
		} catch (error) {
			console.log('TimeLogDeleteHandler', { error });
		}
		return deleteResult;
	}
}
