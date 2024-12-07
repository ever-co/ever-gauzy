import { ICommand } from '@nestjs/cqrs';
import { TimeOffRequest } from '../time-off-request.entity';

export class TimeOffCreateCommand implements ICommand {
	static readonly type = '[TimeOff] Create';

	constructor(public readonly timeOff: TimeOffRequest) {}
}
