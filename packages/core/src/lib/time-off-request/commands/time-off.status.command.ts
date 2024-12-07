import { StatusTypesEnum } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class TimeOffStatusCommand implements ICommand {
	static readonly type = '[TimeOff] Status';

	constructor(
		public readonly id: string,
		public readonly status: StatusTypesEnum
	) {}
}
