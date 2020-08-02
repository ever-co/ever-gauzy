import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeleteResult } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands/timesheet-recalculate.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import * as _ from 'underscore';

@CommandHandler(TimeLogDeleteCommand)
export class TimeLogDeleteHandler
	implements ICommandHandler<TimeLogDeleteCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeLogDeleteCommand): Promise<DeleteResult> {
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
		for (let index = 0; index < timeLogs.length; index++) {
			const timeLog = timeLogs[index];
			await this.timeSlotService.rangeDelete(
				timeLog.employeeId,
				timeLog.startedAt,
				timeLog.stoppedAt
			);
		}
		let deleteResult;
		if (forceDelete) {
			deleteResult = await this.timeLogRepository.delete({
				id: In(_.pluck(timeLogs, 'id'))
			});
		} else {
			deleteResult = await this.timeLogRepository.update(
				{ id: In(_.pluck(timeLogs, 'id')) },
				{ deletedAt: new Date() }
			);
		}

		const timesheetPromises = _.chain(timeLogs)
			.pluck('timesheetId')
			.uniq()
			.map(
				async (timesheetId) =>
					await this.commandBus.execute(
						new TimesheetRecalculateCommand(timesheetId)
					)
			)
			.value();
		try {
			await Promise.all(timesheetPromises);
		} catch (error) {
			console.log('TimeLogDeleteHandler', { error });
		}

		return deleteResult;
	}
}
