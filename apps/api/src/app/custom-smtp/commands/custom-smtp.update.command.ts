import { ICustomSmtpUpdateInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class CustomSmtpUpdateCommand implements ICommand {
	static readonly type = '[Custom SMTP] Update';

	constructor(public readonly input: ICustomSmtpUpdateInput) {}
}
