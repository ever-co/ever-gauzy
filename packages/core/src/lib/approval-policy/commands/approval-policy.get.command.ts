import { IApprovalPolicy } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { BaseQueryDTO } from './../../core/crud';

export class ApprovalPolicyGetCommand implements ICommand {
	static readonly type = '[Approval Policy] Get';

	constructor(public readonly input: BaseQueryDTO<IApprovalPolicy>) {}
}
