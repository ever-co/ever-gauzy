import { ICommand } from '@nestjs/cqrs';
import { TimeSlotMinute } from '@gauzy/models';

export class UpdateTimeSlotMinutesCommand implements ICommand {
	static readonly type = '[TimeSlotMinutes] update';

	constructor(
		public readonly id: string,
		public readonly input: TimeSlotMinute
	) {}
}
