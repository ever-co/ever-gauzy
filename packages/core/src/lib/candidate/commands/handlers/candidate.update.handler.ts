import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ICandidate, ICandidateUpdateInput } from '@gauzy/contracts';
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

		// A candidate edit never writes the linked User. `Candidate.user` cascades, so a nested
		// `user: { id, hash, email }` overwrote ANY user's credentials (another tenant's, or a
		// super admin of the same tenant), and `userId` re-linked the candidate to another account
		// (GHSA-jh6m-9fxr-rx3c). The UI edits the candidate's user through PUT /user/:id instead.
		const candidate: ICandidateUpdateInput = { ...input };
		delete (candidate as any).user;
		delete (candidate as any).userId;

		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.candidateService.create({ ...candidate, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
