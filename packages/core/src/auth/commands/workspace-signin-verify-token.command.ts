import { IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class WorkspeceSigninVerifyTokenCommand implements ICommand {

	static readonly type = '[Password Less] Workspace Signin Verify Token';

	constructor(
		public readonly input: IUserEmailInput & IUserTokenInput
	) { }
}
