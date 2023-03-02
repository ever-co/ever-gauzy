import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from './../time-log.entity';

export class TimeLogUpdateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log update';

	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly id: TimeLog['id'] | TimeLog,
		public readonly manualTimeSlot?: boolean | null
	) {}
}
