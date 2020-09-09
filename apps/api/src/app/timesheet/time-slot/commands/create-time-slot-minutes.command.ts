import { ICommand } from '@nestjs/cqrs';
import { TimeSlotMinute } from '@gauzy/models';

export class CreateTimeSlotMinutesCommand implements ICommand {
	static readonly type = '[TimeSlotMinutes] create';

	constructor(public readonly input: TimeSlotMinute) {}
}
