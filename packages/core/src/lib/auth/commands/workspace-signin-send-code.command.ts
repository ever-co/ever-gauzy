import { ICommand } from '@nestjs/cqrs';
import { IAppIntegrationConfig } from '@gauzy/common';
import { IUserEmailInput, LanguagesEnum } from '@gauzy/contracts';

export class WorkspaceSigninSendCodeCommand implements ICommand {
	static readonly type = '[Password Less] Send Workspace Signin Authentication Code';

	constructor(
		public readonly input: IUserEmailInput & Partial<IAppIntegrationConfig>,
		public readonly locale: LanguagesEnum
	) {}
}
