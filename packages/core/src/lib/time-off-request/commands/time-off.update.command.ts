import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { TimeOffRequest } from '../time-off-request.entity';

export class TimeOffUpdateCommand implements ICommand {
	static readonly type = '[TimeOff] update';

	constructor(public readonly id: ID, public readonly input: TimeOffRequest) {}
}
