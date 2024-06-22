import { ICommand } from '@nestjs/cqrs';
import { IUserRegistrationInput } from '@gauzy/contracts';

export class i4netCloudUserMigrateCommand implements ICommand {
	static readonly type = '[i4net Cloud] User Migrate';

	constructor(public readonly input: IUserRegistrationInput) { }
}
