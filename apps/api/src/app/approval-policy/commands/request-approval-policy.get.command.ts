import { IListQueryInput, IRequestApprovalFindInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class RequestApprovalPolicyGetCommand implements ICommand {
	static readonly type = '[RequestApprovalPolicy] Get';

	constructor(
		public readonly input: IListQueryInput<IRequestApprovalFindInput>
	) {}
}
