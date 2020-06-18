import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateCriterionsRatingBulkCreateCommand } from '../candidate-criterions-rating.bulk.create.command';
import { CandidateCriterionsRatingService } from '../../candidate-criterion-rating.service';
import { ICandidateCriterionsRatingCreateInput } from '@gauzy/models';

@CommandHandler(CandidateCriterionsRatingBulkCreateCommand)
export class CandidateCriterionsRatingBulkCreateHandler
	implements ICommandHandler<CandidateCriterionsRatingBulkCreateCommand> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {}

	public async execute(
		command: CandidateCriterionsRatingBulkCreateCommand
	): Promise<any> {
		const { feedbackId, technologies, qualities } = command;
		let technologyRating: ICandidateCriterionsRatingCreateInput;
		const technologyCreateInput: ICandidateCriterionsRatingCreateInput[] = [];
		for (const item of technologies) {
			technologyRating = {
				rating: item.rating,
				technologyId: item.id,
				feedbackId: feedbackId
			};
			technologyCreateInput.push(technologyRating);
		}

		let qualityRating: ICandidateCriterionsRatingCreateInput;
		const qualityCreateInput: ICandidateCriterionsRatingCreateInput[] = [];
		for (const item of qualities) {
			qualityRating = {
				rating: item.rating,
				personalQualityId: item.id,
				feedbackId: feedbackId
			};
			qualityCreateInput.push(qualityRating);
		}

		return await this.candidateCriterionsRatingService.createBulk(
			technologyCreateInput,
			qualityCreateInput
		);
	}
}
