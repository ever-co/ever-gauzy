import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ApprovalPolicyService } from '../../approval-policy.service';
import { ApprovalPolicyCreateCommand } from '../approval-policy.create.command';

@CommandHandler(ApprovalPolicyCreateCommand)
export class ApprovalPolicyCreateHandler
	implements ICommandHandler<ApprovalPolicyCreateCommand> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService
	) {}

	public async execute(command: ApprovalPolicyCreateCommand): Promise<any> {
		const { input } = command;
		return this.approvalPolicyService.create(input);
	}
}
