import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProposalUpdateCommand } from '../proposal-update.command';
import { ProposalService } from '../../proposal.service';
import { Proposal } from '../../proposal.entity';

@CommandHandler(ProposalUpdateCommand)
export class ProposalUpdateHandler implements ICommandHandler<ProposalUpdateCommand> {
	constructor(
		private readonly _proposalService: ProposalService
	) { }

	/**
	 * Executes the ProposalUpdateCommand to update a proposal.
	 *
	 * @param command The ProposalUpdateCommand containing the id and input data for the update.
	 * @returns A Promise that resolves to the updated Proposal entity.
	 */
	public async execute(command: ProposalUpdateCommand): Promise<Proposal> {
		const { id, input } = command;
		return await this._proposalService.create({ ...input, id });
	}
}
