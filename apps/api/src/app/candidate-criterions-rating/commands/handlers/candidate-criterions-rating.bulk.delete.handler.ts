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
		// const { id } = command;
		// TO DO
		return;
	}
}
