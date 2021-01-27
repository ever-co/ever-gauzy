import { ICommand } from '@nestjs/cqrs';

export class TimeSlotMergeCommand implements ICommand {
	static readonly type = '[TimeSlot] mearge';

	constructor(
		public readonly employeeId: string,
		public readonly start: Date,
		public readonly end: Date
	) {}
}
