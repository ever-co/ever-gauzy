import { IEmailResetFindInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmailResetGetCommand implements ICommand {
	static readonly type = '[Email Reset] Get';

	constructor(
		public readonly input: IEmailResetFindInput
	) {}
}
