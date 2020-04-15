import { IInviteAcceptInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class InviteAcceptUserCommand implements ICommand {
	static readonly type = '[Invite] Accept User';

	constructor(public readonly input: IInviteAcceptInput) {}
}
