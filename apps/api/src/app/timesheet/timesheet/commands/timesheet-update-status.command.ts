import { ICommand } from '@nestjs/cqrs';
import { IUpdateTimesheetStatusInput } from '@gauzy/models';

export class TimesheetUpdateStatusCommand implements ICommand {
	static readonly type = '[Timesheet] update-status';

	constructor(public readonly input: IUpdateTimesheetStatusInput) {}
}
