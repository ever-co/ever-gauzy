import { IEmailReset } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmailResetCreateCommand implements ICommand {
	static readonly type = '[Email Reset] Create';

	constructor(public readonly input: IEmailReset) {}
}
