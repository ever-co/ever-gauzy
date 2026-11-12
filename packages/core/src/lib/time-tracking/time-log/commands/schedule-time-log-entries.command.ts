import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class ScheduleTimeLogEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeLog] Entries';

	/**
	 * @param employeeId The employee whose pending logs are processed; every employee's when not given.
	 * @param organizationId The employee's organization.
	 * @param tenantId The employee's tenant.
	 * @param timeLogIds Only the pending logs among these, when given: after a stop, the runs going when it began.
	 */
	constructor(
		public readonly employeeId?: ID,
		public readonly organizationId?: ID,
		public readonly tenantId?: ID,
		public readonly timeLogIds?: ID[]
	) {}
}
