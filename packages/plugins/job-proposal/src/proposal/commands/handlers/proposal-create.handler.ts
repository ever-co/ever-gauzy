import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProposalCreateCommand } from '../proposal-create.command';
import { ProposalService } from '../../proposal.service';
import { Proposal } from '../../proposal.entity';

@CommandHandler(ProposalCreateCommand)
export class ProposalCreateHandler implements ICommandHandler<ProposalCreateCommand> {
	constructor(
		private readonly _proposalService: ProposalService
	) { }

	/**
	 * Executes a command to create a proposal.
	 *
	 * @param command The command object containing the input data for creating the proposal.
	 * @returns A Promise that resolves to the created Proposal object.
	 */
	public async execute(command: ProposalCreateCommand): Promise<Proposal> {
		const { input } = command;
		return await this._proposalService.create(input);
	}
}
