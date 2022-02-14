import { ICommand } from '@nestjs/cqrs';

export class ScheduleTimeSlotEntriesCommand implements ICommand {
	static readonly type = 'Adjust [TimeSlot] Entries';

	constructor() {}
}