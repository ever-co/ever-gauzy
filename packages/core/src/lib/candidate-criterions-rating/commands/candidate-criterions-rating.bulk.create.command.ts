import { ICommand } from '@nestjs/cqrs';

export class CandidateCriterionsRatingBulkCreateCommand implements ICommand {
	static readonly type = '[CandidateCriterionsRating] Register';

	constructor(
		public readonly feedbackId: string,
		public readonly technologies: any[],
		public readonly qualities: any[]
	) {}
}
