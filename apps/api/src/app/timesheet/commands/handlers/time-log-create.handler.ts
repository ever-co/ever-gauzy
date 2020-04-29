import { TimeLog } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeLogCreateCommand } from '..';
import { TimeLogService } from '../../time-log/time-log.service';
import { BadRequestException } from '@nestjs/common';

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
				startedAt
			} = input;

			return await this._timeLogService.create({
				employeeId,
				duration,
				projectId,
				logType,
				startedAt
			});
		} catch (error) {
			throw new BadRequestException('Cannot create time log');
		}
	}
}
