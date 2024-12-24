import { ICommand } from '@nestjs/cqrs';

export class TimeSlotBulkDeleteCommand implements ICommand {
	static readonly type = '[TimeSlot] delete';

	constructor(
		public readonly input: any,
		public readonly forceDelete: boolean = false, // Force delete
		public readonly entireSlots: boolean = false // Delete entire slots
	) {}
}
