import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class ScheduleTimeLogEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeLog] Entries';

	/**
	 * @param employeeId The employee whose pending logs are processed. Required: the handler refuses a command without
	 *                   it, or without the organization or tenant id, rather than close every employee's pending logs.
	 * @param organizationId The employee's organization. Required.
	 * @param tenantId The employee's tenant. Required.
	 * @param timeLogIds Only the running pending logs among these, when given: the runs the start or stop read. A log
	 *                   stored stopped without an end is still given one.
	 */
	constructor(
		public readonly employeeId?: ID,
		public readonly organizationId?: ID,
		public readonly tenantId?: ID,
		public readonly timeLogIds?: ID[]
	) {}
}
