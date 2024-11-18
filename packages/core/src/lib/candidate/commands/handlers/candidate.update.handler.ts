import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
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
		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.candidateService.create({
				id,
				...input
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
