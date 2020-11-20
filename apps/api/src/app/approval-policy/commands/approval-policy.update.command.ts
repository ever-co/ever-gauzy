import { IApprovalPolicyUpdateInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class ApprovalPolicyUpdateCommand implements ICommand {
	static readonly type = '[ApprovalPolicy] Update';

	constructor(public readonly input: IApprovalPolicyUpdateInput) {}
}
