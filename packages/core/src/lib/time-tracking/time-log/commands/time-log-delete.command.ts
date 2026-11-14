import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

export class TimeLogDeleteCommand implements ICommand {
	static readonly type = '[TimeLog] delete';

	/**
	 * @param history Given by the route through which a person deletes entries: records what each one held.
	 */
	constructor(
		public readonly ids: ID | ID[] | TimeLog | TimeLog[],
		public readonly forceDelete = false,
		public readonly history?: TimeLogHistoryOptions
	) {}
}
