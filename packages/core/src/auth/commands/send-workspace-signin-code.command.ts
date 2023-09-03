import { ICommand } from '@nestjs/cqrs';
import { IUserEmailInput, LanguagesEnum } from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';

export class SendWorkspaceSigninCodeCommand implements ICommand {

	static readonly type = '[Password Less] Send Workspace Signin Authentication Code';

	constructor(
		public readonly input: IUserEmailInput & Partial<IAppIntegrationConfig>,
		public readonly locale: LanguagesEnum
	) { }
}
