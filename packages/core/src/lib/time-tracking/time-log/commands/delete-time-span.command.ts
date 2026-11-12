import { ICommand } from '@nestjs/cqrs';
import { IDateRange, ITimeSlot } from '@gauzy/contracts';
import { TimeLog } from '../time-log.entity';

export class DeleteTimeSpanCommand implements ICommand {
	static readonly type = '[TimeLog] delete time span';

	/**
	 * @param timeSlot - The time slot deleted with the span, when a caller deletes one. Time saved over the log names
	 * none: the span then takes the log's slots whose time on it lies inside the span.
	 */
	constructor(
		public readonly newTime: IDateRange,
		public readonly timeLog: TimeLog,
		public readonly timeSlot?: ITimeSlot,
		public readonly forceDelete: boolean = false
	) {}
}
