import { ICommand } from '@nestjs/cqrs';
import { ICandidateCreateInput, LanguagesEnum } from '@gauzy/contracts';

export class CandidateBulkCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(
		public readonly input: ICandidateCreateInput[],
		public readonly languageCode: LanguagesEnum
	) {}
}
