import { ICommand } from '@nestjs/cqrs';
import { ICustomSmtp, ICustomSmtpUpdateInput } from '@gauzy/contracts';

export class CustomSmtpUpdateCommand implements ICommand {
	static readonly type = '[Custom SMTP] Update';

	constructor(
		public readonly id: ICustomSmtp['id'],
		public readonly input: ICustomSmtpUpdateInput
	) { }
}
