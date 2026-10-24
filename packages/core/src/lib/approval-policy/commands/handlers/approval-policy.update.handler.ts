import { BadRequestException, HttpException } from '@nestjs/common';
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
		try {
			const { id, input } = command;
			return await this.approvalPolicyService.update(id, input);
		} catch (error) {
			// Preserve intentional HTTP exceptions (the 404 for an unknown policy) instead of flattening them to 400
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(error);
		}
	}
}
