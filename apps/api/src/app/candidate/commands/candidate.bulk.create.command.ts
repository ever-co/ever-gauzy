import { ICommand } from '@nestjs/cqrs';
import {
	EmployeeCreateInput as IEmployeeCreateInput,
	CandidateCreateInput
} from '@gauzy/models';

export class CandidateBulkCreateCommand implements ICommand {
	static readonly type = '[Candidate] Register';

	constructor(public readonly input: CandidateCreateInput[]) {}
}
