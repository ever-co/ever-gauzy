import { ICommand } from '@nestjs/cqrs';
import { IUpdateTimesheetStatusInput } from '@gauzy/contracts';

export class TimesheetUpdateStatusCommand implements ICommand {
	static readonly type = '[Timesheet] Update Status';

	constructor(public readonly input: IUpdateTimesheetStatusInput) {}
}
