import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

export class TimeLogUpdateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log update';

	/**
	 * @param history Given by the routes through which a person edits an entry: records the change in its history.
	 * @param stopsRun Given by the timer when it stops a run it read as running (a stop, the end of a run another start
	 * replaces): the update writes only while the row still runs, whatever the handler reads of it later. A row stopped
	 * since by another start or stop refuses it (ever-co/ever-gauzy#11826). Ordinary edits leave it unset.
	 */
	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly id: ID | TimeLog,
		public readonly manualTimeSlot?: boolean | null,
		public readonly forceDelete: boolean = false,
		public readonly history?: TimeLogHistoryOptions,
		public readonly stopsRun: boolean = false
	) {}
}
