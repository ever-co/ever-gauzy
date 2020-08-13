import { ICommand } from '@nestjs/cqrs';
import { TimeOffRequest } from '../time-off-request.entity';

export class TimeOffUpdateCommand implements ICommand {
	static readonly type = '[TimeOff] update';

	constructor(
		public readonly id: string,
		public readonly timeOff: TimeOffRequest
	) {}
}
