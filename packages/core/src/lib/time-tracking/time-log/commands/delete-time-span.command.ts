import { ICommand } from '@nestjs/cqrs';
import { IDateRange, ITimeSlot } from '@gauzy/contracts';
import { TimeLog } from '../time-log.entity';

export class DeleteTimeSpanCommand implements ICommand {
	static readonly type = '[TimeLog] delete time span';

	/**
	 * @param timeSlot - The time slot the time-slot delete removes with the span: it goes even when its log's time no
	 * longer reaches it. Time saved over the log names none, and the cut releases the slots of the time it drops.
	 */
	constructor(
		public readonly newTime: IDateRange,
		public readonly timeLog: TimeLog,
		public readonly timeSlot?: ITimeSlot,
		public readonly forceDelete: boolean = false
	) {}
}
