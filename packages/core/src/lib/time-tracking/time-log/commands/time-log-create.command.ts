import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

export class TimeLogCreateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log create';

	/**
	 * @param input The log to write.
	 * @param history Given by the routes through which a person adds time: records the entry in its history.
	 */
	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly history?: TimeLogHistoryOptions
	) {}
}
