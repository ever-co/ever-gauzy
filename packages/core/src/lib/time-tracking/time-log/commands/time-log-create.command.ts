import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

/** How a timer start's run is created (see `TimeLogCreateHandler`). */
export interface TimeLogCreateOptions {
	/**
	 * The run of a timer start, which the start's close of the employee's runs going leaves the only one running. It is
	 * written in one transaction with the check, under the employee's row lock, that no run of a timer client (any source
	 * but a tracker's, whose uploads are stored running by design) is still running: when one is, nothing is written.
	 */
	readonly isOnlyRun?: boolean;
}

export class TimeLogCreateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log create';

	/**
	 * @param input The log to write.
	 * @param history Given by the routes through which a person adds time: records the entry in its history.
	 * @param options Given by a timer start (`isOnlyRun`).
	 */
	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly history?: TimeLogHistoryOptions,
		public readonly options?: TimeLogCreateOptions
	) {}
}
