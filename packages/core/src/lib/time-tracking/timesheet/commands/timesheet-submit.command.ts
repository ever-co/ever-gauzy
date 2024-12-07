import { ICommand } from '@nestjs/cqrs';
import { ISubmitTimesheetInput } from '@gauzy/contracts';

export class TimesheetSubmitCommand implements ICommand {
	static readonly type = '[Timesheet] Submit';

	constructor(
		public readonly input: ISubmitTimesheetInput
	) {}
}
