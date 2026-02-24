import { ICommand } from '@nestjs/cqrs';
import { ID, ITimeSlot } from '@gauzy/contracts';

export class TimeSlotBulkCreateOrUpdateCommand implements ICommand {
	static readonly type = '[TimeSlot] bulk create / update';

	constructor(
		public readonly slots: ITimeSlot[],
		public readonly employeeId: ID,
		public readonly organizationId: ID,
		public readonly tenantId: ID
	) {}
}
