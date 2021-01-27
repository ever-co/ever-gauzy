import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateCriterionsRatingBulkDeleteCommand } from '../candidate-criterions-rating.bulk.delete.command';
import { CandidateCriterionsRatingService } from '../../candidate-criterion-rating.service';

@CommandHandler(CandidateCriterionsRatingBulkDeleteCommand)
export class CandidateCriterionsRatingBulkDeleteHandler
	implements ICommandHandler<CandidateCriterionsRatingBulkDeleteCommand> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {}

	public async execute(
		command: CandidateCriterionsRatingBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const criterions = await this.candidateCriterionsRatingService.getCriterionsByFeedbackId(
			id
		);
		if (criterions.length > 0) {
			await this.candidateCriterionsRatingService.deleteBulk(
				criterions.map((item) => item.id)
			);
		}
		return;
	}
}
