import { ICommand } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';

export class TimesheetGetCommand implements ICommand {
	static readonly type = '[Timesheet] Get';

	constructor(public readonly input: FindOneOptions) {}
}
