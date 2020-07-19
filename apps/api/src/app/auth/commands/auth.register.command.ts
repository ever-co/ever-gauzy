import { ICommand } from '@nestjs/cqrs';
import {
	UserRegistrationInput as IUserRegistrationInput,
	LanguagesEnum
} from '@gauzy/models';

export class AuthRegisterCommand implements ICommand {
	static readonly type = '[Auth] Register';

	constructor(
		public readonly input: IUserRegistrationInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
