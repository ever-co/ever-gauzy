import { ICommand } from '@nestjs/cqrs';
import { ICandidateCriterionsRating } from '@gauzy/contracts';

export class CandidateCriterionsRatingBulkUpdateCommand implements ICommand {
	static readonly type = '[CandidateCriterionsRating] Update';

	constructor(
		public readonly data: {
			criterionsRating: ICandidateCriterionsRating[];
			technologies: number[];
			personalQualities: number[];
		}
	) {}
}
