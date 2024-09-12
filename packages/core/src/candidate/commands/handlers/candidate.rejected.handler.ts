import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate, LanguagesEnum } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateRejectedCommand } from '../candidate.rejected.command';
import { EmailService } from './../../../email-send/email.service';
import { environment } from '@gauzy/config';
import { UserOrganizationService } from 'user-organization/user-organization.services';

@CommandHandler(CandidateRejectedCommand)
export class CandidateRejectedHandler implements ICommandHandler<CandidateRejectedCommand> {
	constructor(
		private readonly candidateService: CandidateService,
		private readonly _emailService: EmailService,
		private readonly _userOrganizationService: UserOrganizationService
	) {}

	/**
	 * Executes the candidate rejection process.
	 *
	 * @param {CandidateRejectedCommand} command - The command containing the candidate ID.
	 * @returns {Promise<ICandidate>} - The updated candidate object.
	 * @throws {ConflictException} - If the candidate is already hired.
	 * @throws {BadRequestException} - If there is an error during the update process.
	 */
	public async execute({ id }: CandidateRejectedCommand): Promise<ICandidate> {
		// Fetch the candidate by ID
		const candidate: ICandidate = await this.candidateService.findOneByIdString(id, {
			relations: { user: true, organization: true }
		});

		// Check if the candidate is already hired
		if (candidate.alreadyHired) {
			throw new ConflictException('The candidate is already hired, you cannot reject it.');
		}

		try {
			// Prepare the updated candidate data
			const updatedCandidate: Partial<ICandidate> = {
				status: CandidateStatusEnum.REJECTED,
				rejectDate: candidate.rejectDate || new Date(), // Use existing reject date or current date
				hiredDate: null // Clear the hired date
			};

			// Update the candidate in the database
			await this.candidateService.update(id, updatedCandidate);

			// Send rejection email to candidate
			const languageCode = candidate.user.preferredLanguage as LanguagesEnum;
			const { email, name } = candidate.user;
			const organization = candidate.organization;
			const originUrl = environment.clientBaseUrl;

			// Call the email service to send the rejection email
			this._emailService.sendRejectionEmail(
				languageCode || LanguagesEnum.ENGLISH,
				email,
				name,
				organization,
				originUrl
			);

			// Return the merged candidate object with the updated data
			return { ...candidate, ...updatedCandidate } as ICandidate;
		} catch (error) {
			// Handle any errors that occur during the update process
			throw new BadRequestException(error.message || error);
		}
	}
}
