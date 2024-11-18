import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICandidateInterviewers, ICandidateInterviewersCreateInput } from '@gauzy/contracts';
import { CandidateInterviewersBulkCreateCommand } from '../candidate-interviewers.bulk.create.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';

@CommandHandler(CandidateInterviewersBulkCreateCommand)
export class CandidateInterviewersBulkCreateHandler
	implements ICommandHandler<CandidateInterviewersBulkCreateCommand> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService
	) {}

	public async execute(
		command: CandidateInterviewersBulkCreateCommand
	): Promise<ICandidateInterviewers[]> {
		const { input } = command;
		let interviewer: ICandidateInterviewersCreateInput;
		const createInput: ICandidateInterviewersCreateInput[] = [];

		const { employeeIds, interviewId, organizationId, tenantId } = input;

		for (const employeeId of employeeIds) {
			interviewer = { interviewId, employeeId, organizationId, tenantId };
			createInput.push(interviewer);
		}
		return await this.candidateInterviewersService.createBulk(createInput);
	}
}
