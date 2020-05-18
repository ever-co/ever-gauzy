import { ICommand } from '@nestjs/cqrs';
import {
	CandidateCreateInput as ICandidateCreateInput,
	LanguagesEnum
} from '@gauzy/models';

export class CandidateBulkCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(
		public readonly input: ICandidateCreateInput[],
		public readonly languageCode: LanguagesEnum
	) {}
}
