import { ICommand } from '@nestjs/cqrs';
import { IPasswordResetFindInput } from '@gauzy/contracts';

export class PasswordResetGetCommand implements ICommand {
	static readonly type = '[Password Reset] Get';

	constructor(public readonly input: IPasswordResetFindInput) {}
}
