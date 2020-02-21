import { ICommand } from '@nestjs/cqrs';
import { UserCreateInput as IUserCreateInput } from '@gauzy/models';

export class UserCreateCommand implements ICommand {
	static readonly type = '[User] Register';

	constructor(public readonly input: IUserCreateInput) {}
}
