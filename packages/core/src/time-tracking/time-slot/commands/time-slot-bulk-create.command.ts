import { ICommand } from '@nestjs/cqrs';
import { ITimeSlot } from '@gauzy/contracts';

export class TimeSlotBulkCreateCommand implements ICommand {
	static readonly type = '[TimeSlot] bulk create';

	constructor(
		public readonly slots: ITimeSlot[],
		public readonly employeeId: string,
		public readonly organizationId: string
	) {}
}
