import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateCriterionsRatingBulkDeleteCommand } from '../candidate-criterions-rating.bulk.delete.command';
import { CandidateCriterionsRatingService } from '../../candidate-criterion-rating.service';

@CommandHandler(CandidateCriterionsRatingBulkDeleteCommand)
export class CandidateCriterionsRatingBulkDeleteHandler implements ICommandHandler<CandidateCriterionsRatingBulkDeleteCommand> {
	constructor(private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService) {}

	public async execute(command: CandidateCriterionsRatingBulkDeleteCommand): Promise<void> {
		const { id: feedbackId } = command;

		const criterions = await this.candidateCriterionsRatingService.getCriterionsByFeedbackId(feedbackId);

		if (!criterions?.length) {
			return;
		}

		const criterionIds = criterions.map((c) => c.id);

		await this.candidateCriterionsRatingService.deleteMany(criterionIds);
	}
}
