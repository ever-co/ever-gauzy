import { ICandidateCriterionsRating } from './../../../../../../../libs/models/src/lib/candidate-criterions-rating.model';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateCriterionsRatingService } from '../../candidate-criterion-rating.service';
import { CandidateCriterionsRatingBulkUpdateCommand } from '../candidate-criterions-rating.bulk.update.command';

@CommandHandler(CandidateCriterionsRatingBulkUpdateCommand)
export class CandidateCriterionsRatingBulkUpdateHandler
	implements ICommandHandler<CandidateCriterionsRatingBulkUpdateCommand> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {}

	public async execute(
		command: CandidateCriterionsRatingBulkUpdateCommand
	): Promise<any> {
		const { data } = command;
		return this.candidateCriterionsRatingService.updateBulk(
			this.setRating(
				data.personalQualities,
				data.criterionsRating.filter((tech) => tech.personalQualityId)
			),
			this.setRating(
				data.technologies,
				data.criterionsRating.filter((tech) => tech.technologyId)
			)
		);
	}
	setRating(ratings: number[], data: ICandidateCriterionsRating[]) {
		for (let i = 0; i < ratings.length; i++) {
			data[i].rating = ratings[i];
		}
		return data;
	}
}
