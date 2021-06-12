import { ICommand } from '@nestjs/cqrs';
import { IUserRegistrationInput } from '@gauzy/contracts';

export class GauzyCloudMigrateCommand implements ICommand {
	static readonly type = '[Gauzy Cloud] Migrate';

	constructor(public readonly input: IUserRegistrationInput) {}
}
