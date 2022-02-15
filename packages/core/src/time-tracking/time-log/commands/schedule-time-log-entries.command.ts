import { ICommand } from '@nestjs/cqrs';

export class ScheduleTimeLogEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeLog] Entries';

	constructor() {}
}