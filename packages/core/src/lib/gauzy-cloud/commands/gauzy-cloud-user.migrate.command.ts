import { ICommand } from '@nestjs/cqrs';
import { IUserRegistrationInput } from '@gauzy/contracts';

export class GauzyCloudUserMigrateCommand implements ICommand {
	static readonly type = '[DSpot ERP Cloud] User Migrate';

	constructor(public readonly input: IUserRegistrationInput) {}
}
