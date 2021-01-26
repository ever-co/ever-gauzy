import { ICommand } from '@nestjs/cqrs';
import { IUpdateTimesheetStatusInput } from '@gauzy/contracts';

export class TimesheetUpdateStatusCommand implements ICommand {
	static readonly type = '[Timesheet] update-status';

	constructor(public readonly input: IUpdateTimesheetStatusInput) {}
}
