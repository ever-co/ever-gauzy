import { ICommand } from '@nestjs/cqrs';
import { ICandidateCreateInput, LanguagesEnum } from '@gauzy/contracts';

export class CandidateCreateCommand implements ICommand {
	static readonly type = '[Candidate] Create';

	constructor(
		public readonly input: ICandidateCreateInput,
		public readonly languageCode?: LanguagesEnum,
		public readonly originUrl?: string
	) {}
}
