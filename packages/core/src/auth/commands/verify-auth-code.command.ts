import { IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class VerifyAuthCodeCommand implements ICommand {

	static readonly type = '[Password Less] Verify Auth Code';

	constructor(
		public readonly input: IUserEmailInput & IUserTokenInput
	) { }
}
