import { ICommand } from '@nestjs/cqrs';

export class DeleteTimeSlotCommand implements ICommand {
	static readonly type = '[TimeSlot] delete';

	constructor(public readonly ids: string[]) {}
}
