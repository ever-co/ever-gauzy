import { ICommand } from '@nestjs/cqrs';
import { ICandidateCreateInput } from '@gauzy/models';

export class CandidateCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(public readonly input: ICandidateCreateInput) {}
}
