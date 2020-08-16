import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProposalCreateCommand } from '../proposal-create.command';
import { ProposalService } from '../../proposal.service';
import { Proposal } from '../../proposal.entity';

@CommandHandler(ProposalCreateCommand)
export class ProposalCreateHandler
	implements ICommandHandler<ProposalCreateCommand> {
	constructor(private readonly _proposalService: ProposalService) {}

	public async execute(command: ProposalCreateCommand): Promise<Proposal> {
		const { input } = command;
		return await this._proposalService.create(input);
	}
}
