import { ICommand } from '@nestjs/cqrs';
import { ITimeSlotMinute } from '@gauzy/models';

export class TimeSlotMinuteCreateCommand implements ICommand {
	static readonly type = '[TimeSlotMinute] Create TimeSlot';

	constructor(public readonly input: ITimeSlotMinute) {}
}
