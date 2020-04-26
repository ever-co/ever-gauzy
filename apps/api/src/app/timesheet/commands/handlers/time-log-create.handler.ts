import { TimeLog } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeLogCreateCommand } from '..';
import { TimeLogService } from '../../time-log/time-log.service';
import { TimeSlotService } from '../../time-slot.service';

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler
	implements ICommandHandler<TimeLogCreateCommand> {
	constructor(
		private readonly _timeLogService: TimeLogService,
		private _timeSlotService: TimeSlotService
	) {}

	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		const { input } = command;
		const { employeeId, duration, startedAt, projectId, logType } = input;

		// {}
		await this._timeSlotService.create({});

		return await this._timeLogService.create({
			employeeId,
			duration,
			startedAt,
			// stoppedAt,
			projectId,
			logType
		});
	}
}
