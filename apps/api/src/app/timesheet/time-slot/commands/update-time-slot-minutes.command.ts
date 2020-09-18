import { ICommand } from '@nestjs/cqrs';
import { ITimeSlotMinute } from '@gauzy/models';

export class UpdateTimeSlotMinutesCommand implements ICommand {
	static readonly type = '[TimeSlotMinutes] update';

	constructor(
		public readonly id: string,
		public readonly input: ITimeSlotMinute
	) {}
}
