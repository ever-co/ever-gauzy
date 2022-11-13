import { IUserInviteCodeConfirmationInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ConfirmInviteCodeCommand implements ICommand {

	static readonly type = '[Auth] Confirm Invite Code';

	constructor(
		public readonly input: IUserInviteCodeConfirmationInput
	) {}
}
