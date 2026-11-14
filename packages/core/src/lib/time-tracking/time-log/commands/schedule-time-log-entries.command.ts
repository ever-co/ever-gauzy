import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class ScheduleTimeLogEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeLog] Entries';

	constructor(
		public readonly employeeId?: ID,
		public readonly organizationId?: ID,
		public readonly tenantId?: ID,
		/** The start of the run that replaces the pending entries, if a start closes them: a running break ends there. */
		public readonly replacedAt?: Date
	) {}
}
