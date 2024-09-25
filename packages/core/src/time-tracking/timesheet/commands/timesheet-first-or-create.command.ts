import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class TimesheetFirstOrCreateCommand implements ICommand {
	static readonly type = '[Timesheet] First Or Create';

	constructor(
		public readonly date: Date,
		public readonly employeeId: ID,
		public readonly organizationId?: ID
	) { }
}
