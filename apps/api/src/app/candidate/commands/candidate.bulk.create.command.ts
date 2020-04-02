import { ICommand } from '@nestjs/cqrs';
import { CandidateCreateInput as ICandidateCreateInput } from '@gauzy/models';

export class CandidateBulkCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(public readonly input: ICandidateCreateInput[]) {}
}
