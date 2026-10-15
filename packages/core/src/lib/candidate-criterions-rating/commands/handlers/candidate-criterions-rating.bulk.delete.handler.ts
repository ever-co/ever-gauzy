import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { CandidateCriterionsRatingBulkDeleteCommand } from '../candidate-criterions-rating.bulk.delete.command';
import { CandidateCriterionsRatingService } from '../../candidate-criterion-rating.service';

@CommandHandler(CandidateCriterionsRatingBulkDeleteCommand)
export class CandidateCriterionsRatingBulkDeleteHandler implements ICommandHandler<CandidateCriterionsRatingBulkDeleteCommand> {
	constructor(private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService) {}

	/**
	 * Removes every criterion rating of one verdict.
	 *
	 * @returns The delete result, so a caller can tell a verdict whose ratings went from one that had none
	 * (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: CandidateCriterionsRatingBulkDeleteCommand): Promise<DeleteResult> {
		const { id: feedbackId } = command;

		const criterions = await this.candidateCriterionsRatingService.getCriterionsByFeedbackId(feedbackId);

		if (!criterions?.length) {
			return { affected: 0, raw: [] };
		}

		const criterionIds = criterions.map((c) => c.id);

		return await this.candidateCriterionsRatingService.deleteMany(criterionIds);
	}
}
