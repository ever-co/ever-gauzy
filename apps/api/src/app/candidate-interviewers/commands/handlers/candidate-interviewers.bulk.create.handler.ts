import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateInterviewersBulkCreateCommand } from '../candidate-interviewers.bulk.create.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';
import { CandidateInterviewers } from '../../candidate-interviewers.entity';
import { ICandidateInterviewersCreateInput } from '@gauzy/models';

@CommandHandler(CandidateInterviewersBulkCreateCommand)
export class CandidateInterviewersBulkCreateHandler
	implements ICommandHandler<CandidateInterviewersBulkCreateCommand> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService
	) {}

	public async execute(
		command: CandidateInterviewersBulkCreateCommand
	): Promise<CandidateInterviewers[]> {
		const { interviewId, employeeIds } = command;
		let interviewer: ICandidateInterviewersCreateInput;
		const createInput: ICandidateInterviewersCreateInput[] = [];

		for (const employeeId of employeeIds) {
			interviewer = { interviewId: interviewId, employeeId: employeeId };
			createInput.push(interviewer);
		}
		return await this.candidateInterviewersService.createBulk(createInput);
	}
}
