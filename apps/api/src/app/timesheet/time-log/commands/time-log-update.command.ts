import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from '../../time-log.entity';

export class TimeLogUpdateCommand implements ICommand {
	static readonly type = '[TimeLog] update';

	constructor(
		public readonly input: Partial<TimeLog & { manualTimeSlot: boolean }>,
		public readonly id: string | TimeLog
	) {}
}
