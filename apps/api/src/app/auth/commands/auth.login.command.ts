import { ICommand } from '@nestjs/cqrs';
import { IAuthLoginInput } from '@gauzy/models';

export class AuthLoginCommand implements ICommand {
	static readonly type = '[Auth] Login';

	constructor(public readonly input: IAuthLoginInput) {}
}
