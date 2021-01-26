import { IApprovalPolicy, IPagination } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ApprovalPolicyService } from '../../approval-policy.service';
import { ApprovalPolicyGetCommand } from '../approval-policy.get.command';

@CommandHandler(ApprovalPolicyGetCommand)
export class ApprovalPolicyGetHandler
	implements ICommandHandler<ApprovalPolicyGetCommand> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService
	) {}

	public async execute(
		command: ApprovalPolicyGetCommand
	): Promise<IPagination<IApprovalPolicy>> {
		const { input } = command;
		return this.approvalPolicyService.findAllApprovalPolicies(input);
	}
}
