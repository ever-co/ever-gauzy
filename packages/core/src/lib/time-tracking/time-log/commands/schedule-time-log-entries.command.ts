import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class ScheduleTimeLogEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeLog] Entries';

	constructor(
		public readonly employeeId?: ID,
		public readonly organizationId?: ID,
		public readonly tenantId?: ID
	) {}
}
