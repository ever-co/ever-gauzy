import { TimeLog } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeLogCreateCommand } from '..';
import { TimeLogService } from '../../time-log/time-log.service';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler
	implements ICommandHandler<TimeLogCreateCommand> {
	constructor(private readonly _timeLogService: TimeLogService) {}

	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		try {
			const { input } = command;
			const {
				employeeId,
				duration,
				projectId,
				logType,
				startedAt,
				timesheetId,
			} = input;

			return await this._timeLogService.create({
				employeeId,
				projectId,
				logType,
				startedAt,
				timesheetId,
				stoppedAt: moment(startedAt).add(duration, 'seconds').toDate(),
			});
		} catch (error) {
			throw new BadRequestException('Cannot create time log');
		}
	}
}
