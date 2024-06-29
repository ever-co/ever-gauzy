import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateRejectedCommand } from '../candidate.rejected.command';

@CommandHandler(CandidateRejectedCommand)
export class CandidateRejectedHandler implements ICommandHandler<CandidateRejectedCommand> {
	constructor(private readonly candidateService: CandidateService) {}

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
		const candidate: ICandidate = await this.candidateService.findOneByIdString(id);

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

			// Return the merged candidate object with the updated data
			return { ...candidate, ...updatedCandidate } as ICandidate;
		} catch (error) {
			// Handle any errors that occur during the update process
			throw new BadRequestException(error.message || error);
		}
	}
}
