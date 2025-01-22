import { ICommand } from '@nestjs/cqrs';
import { IAppIntegrationConfig } from '@gauzy/common';
import { IUserRegistrationInput, LanguagesEnum } from '@gauzy/contracts';

export class AuthRegisterCommand implements ICommand {
	static readonly type = '[Auth] Register';

	constructor(
		public readonly input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		public readonly languageCode: LanguagesEnum
	) {}
}
