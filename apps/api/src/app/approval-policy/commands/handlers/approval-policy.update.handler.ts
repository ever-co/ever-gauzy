import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ApprovalPolicyService } from '../../approval-policy.service';
import { ApprovalPolicyUpdateCommand } from '../approval-policy.update.command';

@CommandHandler(ApprovalPolicyUpdateCommand)
export class ApprovalPolicyUpdateHandler
	implements ICommandHandler<ApprovalPolicyUpdateCommand> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService
	) {}

	public async execute(command: ApprovalPolicyUpdateCommand): Promise<any> {
		const { input } = command;
		const { id } = input;
		return this.approvalPolicyService.update(id, input);
	}
}
