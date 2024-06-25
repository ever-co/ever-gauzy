import { ICandidate } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class CandidateRejectedCommand implements ICommand {
	static readonly type = '[Candidate] Rejected';

	constructor(public readonly id: ICandidate['id']) {}
}
