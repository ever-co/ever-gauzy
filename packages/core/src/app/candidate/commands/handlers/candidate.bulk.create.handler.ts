import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
	ICandidate,
	ICandidateCreateInput,
	LanguagesEnum
} from '@gauzy/contracts';
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
	): Promise<ICandidate[]> {
		const { input, languageCode } = command;
		const inputWithHash = await this._loadPasswordHash(input);

		const createdCandidates = await this.candidateService.createBulk(
			inputWithHash
		);
		this._sendWelcomeEmail(createdCandidates, languageCode);

		return createdCandidates;
	}

	private _sendWelcomeEmail(
		candidates: ICandidate[],
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

	private async _loadPasswordHash(input: ICandidateCreateInput[]) {
		const mappedInput = input.map(async (entity) => {
			entity.user.hash = await this.authService.getPasswordHash(
				entity.password
			);
			return entity;
		});
		return Promise.all(mappedInput);
	}
}
