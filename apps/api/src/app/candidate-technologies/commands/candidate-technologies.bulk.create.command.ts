import { ICommand } from '@nestjs/cqrs';

export class CandidateTechnologiesBulkCreateCommand implements ICommand {
	static readonly type = '[CandidateTechnologies] Register';

	constructor(
		public readonly interviewId: string,
		public readonly technologies: string[]
	) {}
}
