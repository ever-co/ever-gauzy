import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Candidate, CandidateCreateInput } from '@gauzy/models';
import { AuthService } from '../../../auth';
import { EmailService } from '../../../email';
import { CandidateBulkCreateCommand } from '../candidate.bulk.create.command';
import { CandidateService } from '../../candidate.service';

@CommandHandler(CandidateBulkCreateCommand)
export class CandidateBulkCreateHandler
	implements ICommandHandler<CandidateBulkCreateCommand> {
	constructor(
		private readonly candidateService: CandidateService,
		private readonly authService: AuthService,
		private readonly emailService: EmailService
	) {}

	public async execute(
		command: CandidateBulkCreateCommand
	): Promise<Candidate[]> {
		const { input } = command;
		const inputWithHash = await this._loadPasswordHash(input);

		const createdCandidates = await this.candidateService.createBulk(
			inputWithHash
		);

		this._sendWelcomeEmail(createdCandidates);

		return createdCandidates;
	}

	private _sendWelcomeEmail(candidates: Candidate[]) {
		candidates.map((candidate) =>
			this.emailService.welcomeUser(candidate.user)
		);
	}

	private async _loadPasswordHash(input: CandidateCreateInput[]) {
		const mappedInput = input.map(async (entity) => {
			entity.user.hash = await this.authService.getPasswordHash(
				entity.password
			);
			return entity;
		});
		return Promise.all(mappedInput);
	}
}
