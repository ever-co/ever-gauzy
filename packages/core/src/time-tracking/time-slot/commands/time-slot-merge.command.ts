import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class TimeSlotMergeCommand implements ICommand {
	static readonly type = '[TimeSlot] merge';

	constructor(
		public readonly organizationId: ID,
		public readonly employeeId: ID,
		public readonly start: Date,
		public readonly end: Date
	) {}
}
