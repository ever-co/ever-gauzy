import { TimeLog } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeLogCreateCommand } from '..';
import { TimeLogService } from '../../time-log/time-log.service';

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler
	implements ICommandHandler<TimeLogCreateCommand> {
	constructor(private readonly _timeLogService: TimeLogService) {}

	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		const { input } = command;
		const { employeeId, duration, projectId, logType } = input;

		return await this._timeLogService.create({
			employeeId,
			duration,
			projectId,
			logType
		});
	}
}
