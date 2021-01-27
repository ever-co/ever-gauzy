import { IListQueryInput, IRequestApprovalFindInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ApprovalPolicyGetCommand implements ICommand {
	static readonly type = '[ApprovalPolicy] Get';

	constructor(
		public readonly input: IListQueryInput<IRequestApprovalFindInput>
	) {}
}
