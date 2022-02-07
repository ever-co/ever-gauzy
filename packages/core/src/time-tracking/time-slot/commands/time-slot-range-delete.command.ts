import { ICommand } from '@nestjs/cqrs';

export class TimeSlotRangeDeleteCommand implements ICommand {
	static readonly type = '[TimeSlot] delete';

	constructor(
		public readonly organizationId: string,
		public readonly employeeId: string,
		public readonly start: Date,
		public readonly stop: Date
	) {}
}
