import { ICommand } from '@nestjs/cqrs';

export class TimesheetFirstOrCreateCommand implements ICommand {
	static readonly type = '[Timesheet] first-or-create';

	constructor(
		public readonly date: Date,
		public readonly employeeId: string
	) {}
}
