import { IApprovalPolicy, IPagination } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ApprovalPolicyService } from '../../approval-policy.service';
import { RequestApprovalPolicyGetCommand } from '../request-approval-policy.get.command';

@CommandHandler(RequestApprovalPolicyGetCommand)
export class RequestApprovalPolicyGetHandler
	implements ICommandHandler<RequestApprovalPolicyGetCommand> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService
	) {}

	public async execute(
		command: RequestApprovalPolicyGetCommand
	): Promise<IPagination<IApprovalPolicy>> {
		const { input } = command;
		return this.approvalPolicyService.findApprovalPoliciesForRequestApproval(
			input
		);
	}
}
