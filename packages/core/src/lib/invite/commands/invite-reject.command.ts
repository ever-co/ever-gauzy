import { ICommand } from '@nestjs/cqrs';
import { IInviteRejectInput } from '@gauzy/contracts';

/**
 * Reject invite command
 */
export class InviteRejectCommand implements ICommand {
	static readonly type = '[Invite Employee/User/Candidate] Reject';

	constructor(public readonly input: IInviteRejectInput) {}
}
