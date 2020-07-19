import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Candidate, CandidateCreateInput, LanguagesEnum } from '@gauzy/models';
import { AuthService } from '../../../auth/auth.service';
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
		const { input, languageCode } = command;
		const inputWithHash = await this._loadPasswordHash(input);

		const createdCandidates = await this.candidateService.createBulk(
			inputWithHash
		);

		this._sendWelcomeEmail(createdCandidates, languageCode);

		return createdCandidates;
	}

	private _sendWelcomeEmail(
		candidates: Candidate[],
		languageCode: LanguagesEnum
	) {
		candidates.forEach((candidate) =>
			this.emailService.welcomeUser(
				candidate.user,
				languageCode,
				candidate.organization.id
			)
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
