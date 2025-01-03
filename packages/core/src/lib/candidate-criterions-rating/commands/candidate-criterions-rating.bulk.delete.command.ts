import { ICommand } from '@nestjs/cqrs';

export class CandidateCriterionsRatingBulkDeleteCommand implements ICommand {
	static readonly type = '[CandidateCriterionsRating] Delete';

	constructor(public readonly id: string) {}
}
