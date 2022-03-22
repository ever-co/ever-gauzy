import { ICommand } from '@nestjs/cqrs';

export class TimeSlotBulkDeleteCommand implements ICommand {
	static readonly type = '[TimeSlot] delete';

	constructor(
		public readonly input: any,
		public readonly forceDirectDelete: boolean = false
	) {}
}
