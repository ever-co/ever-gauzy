import { ICustomSmtp, ICustomSmtpUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class CustomSmtpUpdateCommand implements ICommand {
	static readonly type = '[Custom SMTP] Update';

	constructor(
		public readonly id: ICustomSmtp['id'],
		public readonly input: ICustomSmtpUpdateInput
	) { }
}
