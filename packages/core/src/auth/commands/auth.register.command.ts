import { ICommand } from '@nestjs/cqrs';
import { IUserRegistrationInput, LanguagesEnum } from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';

export class AuthRegisterCommand implements ICommand {
	static readonly type = '[Auth] Register';

	constructor(
		public readonly input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		public readonly languageCode: LanguagesEnum,
	) { }
}
