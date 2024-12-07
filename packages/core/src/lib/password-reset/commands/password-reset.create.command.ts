import { ICommand } from '@nestjs/cqrs';
import { IPasswordReset } from '@gauzy/contracts';

export class PasswordResetCreateCommand implements ICommand {
	static readonly type = '[Password Reset] Create';

	constructor(public readonly input: IPasswordReset) {}
}
