import { ICommand } from '@nestjs/cqrs';
import { TimeSlot } from '@gauzy/models';

export class UpdateTimeSlotCommand implements ICommand {
	static readonly type = '[TimeSlot] update';

	constructor(public readonly id: string, public readonly input: TimeSlot) {}
}
