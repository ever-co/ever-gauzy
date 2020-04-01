import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Candidate } from '@gauzy/models';
import { CandidateCreateCommand } from '../candidate.create.command';
import { CandidateService } from '../../candidate.service';

@CommandHandler(CandidateCreateCommand)
export class CandidateCreateHandler
	implements ICommandHandler<CandidateCreateCommand> {
	constructor(private readonly candidateService: CandidateService) {}

	public async execute(command: CandidateCreateCommand): Promise<Candidate> {
		const { input } = command;

		return await this.candidateService.create(input);
	}
}
