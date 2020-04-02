import { ICommand } from '@nestjs/cqrs';
import { CandidateCreateInput } from '@gauzy/models';

export class CandidateCreateCommand implements ICommand {
	static readonly type = '[Condidate] Register';

	constructor(public readonly input: CandidateCreateInput) {}
}
