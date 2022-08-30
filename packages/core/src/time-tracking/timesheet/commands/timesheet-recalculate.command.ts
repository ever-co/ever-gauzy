import { ICommand } from '@nestjs/cqrs';

export class TimesheetRecalculateCommand implements ICommand {
	static readonly type = '[Timesheet] Recalculate';

	constructor(public readonly id: string) {}
}
