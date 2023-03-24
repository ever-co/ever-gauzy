import { ITimesheet } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class TimesheetFirstOrCreateCommand implements ICommand {
	static readonly type = '[Timesheet] First Or Create';

	constructor(
		public readonly date: Date,
		public readonly employeeId: ITimesheet['employeeId'],
		public readonly organizationId?: ITimesheet['organizationId']
	) { }
}
