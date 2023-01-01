import { ITimeSlot } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class TimeSlotMergeCommand implements ICommand {
	static readonly type = '[TimeSlot] merge';

	constructor(
		public readonly organizationId: ITimeSlot['organizationId'],
		public readonly employeeId: ITimeSlot['employeeId'],
		public readonly start: ITimeSlot['startedAt'],
		public readonly end: ITimeSlot['stoppedAt']
	) {}
}