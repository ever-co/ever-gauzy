import { ICommand } from '@nestjs/cqrs';
import { ICandidateInterviewersDeleteInput } from '@gauzy/contracts';

export class CandidateInterviewersEmployeeBulkDeleteCommand
	implements ICommand {
	static readonly type = '[CandidateInterviewers] Delete';

	constructor(
		public readonly deleteInput: ICandidateInterviewersDeleteInput[]
	) {}
}
