import { ICommand } from '@nestjs/cqrs';
import { ICandidateCreateInput } from '@gauzy/contracts';

export class CandidateCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(public readonly input: ICandidateCreateInput) {}
}
