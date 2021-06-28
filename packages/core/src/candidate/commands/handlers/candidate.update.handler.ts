import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICandidate } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateUpdateCommand } from '../candidate.update.command';

@CommandHandler(CandidateUpdateCommand)
export class CandidateUpdateHandler
	implements ICommandHandler<CandidateUpdateCommand> {

	constructor(
		private readonly candidateService: CandidateService
	) {}

	public async execute(command: CandidateUpdateCommand): Promise<ICandidate> {
		const { input } = command;
		const { id } = input;
		
		return await this.candidateService.create({ 
			id, 
			...input
		});
	}
}
