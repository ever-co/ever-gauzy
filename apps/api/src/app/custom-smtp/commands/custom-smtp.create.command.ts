import { ICustomSmtpCreateInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class CustomSmtpCreateCommand implements ICommand {
	static readonly type = '[Custom SMTP] Create';

	constructor(public readonly input: ICustomSmtpCreateInput) {}
}
