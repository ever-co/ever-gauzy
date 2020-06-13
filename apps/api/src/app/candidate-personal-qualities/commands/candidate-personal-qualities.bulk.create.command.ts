import { ICommand } from '@nestjs/cqrs';

export class CandidatePersonalQualitiesBulkCreateCommand implements ICommand {
	static readonly type = '[CandidatePersonalQualities] Register';

	constructor(
		public readonly interviewId: string,
		public readonly personalQualities: string[]
	) {}
}
