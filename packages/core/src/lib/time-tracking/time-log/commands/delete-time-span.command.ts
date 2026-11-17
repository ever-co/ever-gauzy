import { ICommand } from '@nestjs/cqrs';
import { IDateRange, ITimeSlot } from '@gauzy/contracts';
import { TimeLog } from '../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

/** What the second part of a split changes: the fields left out are the log's own. */
export type TimeLogSplitPartChanges = Partial<Pick<TimeLog, 'taskId' | 'projectId' | 'description' | 'isBillable'>>;

/**
 * A split asked for at one moment (`POST /timesheet/time-log/:id/split`): the span is that moment, the log ends there
 * and the rest becomes its second part, through the same split as time saved inside a log.
 */
export interface TimeLogSplitOptions {
	/** What the second part changes. */
	secondPart: TimeLogSplitPartChanges;
	/** Records the split in the history of both parts, with the reason given. */
	history?: TimeLogHistoryOptions;
}

export class DeleteTimeSpanCommand implements ICommand {
	static readonly type = '[TimeLog] delete time span';

	/**
	 * @param timeSlot - The time slot the time-slot delete removes with the span: it goes even when its log's time no
	 * longer reaches it. Time saved over the log names none, and the cut releases the slots of the time it drops.
	 * @param split - Given by the split route: the span is one moment, where the log is split (see
	 * `TimeLogSplitOptions`).
	 */
	constructor(
		public readonly newTime: IDateRange,
		public readonly timeLog: TimeLog,
		public readonly timeSlot?: ITimeSlot,
		public readonly forceDelete: boolean = false,
		public readonly split?: TimeLogSplitOptions
	) {}
}
