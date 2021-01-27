import { ICustomSmtpCreateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class CustomSmtpCreateCommand implements ICommand {
	static readonly type = '[Custom SMTP] Create';

	constructor(public readonly input: ICustomSmtpCreateInput) {}
}
