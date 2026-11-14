import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

export class TimeLogUpdateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log update';

	/**
	 * @param history Given by the routes through which a person edits an entry: records the change in its history.
	 */
	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly id: ID | TimeLog,
		public readonly manualTimeSlot?: boolean | null,
		public readonly forceDelete: boolean = false,
		public readonly history?: TimeLogHistoryOptions
	) {}
}
