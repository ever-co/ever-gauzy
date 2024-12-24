import { ICommand } from '@nestjs/cqrs';

export class RequestApprovalStatusCommand implements ICommand {
	static readonly type = '[RequestApproval] Status';

	constructor(
		public readonly requestApprovalId: string,
		public readonly status: number
	) {}
}
