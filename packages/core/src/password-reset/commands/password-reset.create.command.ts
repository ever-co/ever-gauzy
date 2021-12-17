import { IPasswordReset } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class PasswordResetCreateCommand implements ICommand {
	static readonly type = '[Password Reset] Create';

	constructor(
		public readonly input: IPasswordReset
	) {}
}
