import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICandidate } from '@gauzy/contracts';
import { CandidateCreateCommand } from '../candidate.create.command';
import { CandidateService } from '../../candidate.service';

@CommandHandler(CandidateCreateCommand)
export class CandidateCreateHandler
	implements ICommandHandler<CandidateCreateCommand> {
	constructor(private readonly candidateService: CandidateService) {}

	public async execute(command: CandidateCreateCommand): Promise<ICandidate> {
		const { input } = command;
		return await this.candidateService.create(input);
	}
}
