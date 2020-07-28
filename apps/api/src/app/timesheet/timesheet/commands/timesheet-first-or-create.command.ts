import { ICommand } from '@nestjs/cqrs';
import { Timesheet } from '../../timesheet.entity';

export class TimesheetFirstOrCreateCommand implements ICommand {
	static readonly type = '[Timesheet] first-or-create';

	constructor(
		public readonly date: Date,
		public readonly employeeId: string
	) {}
}
