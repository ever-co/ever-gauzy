import { ICommand } from '@nestjs/cqrs';
import { IUserEmailInput } from '@gauzy/contracts';

export class SendInviteCodeCommand implements ICommand {

	static readonly type = '[Auth] Send Invite Code';

	constructor(
		public readonly input: IUserEmailInput
	) {}
}
