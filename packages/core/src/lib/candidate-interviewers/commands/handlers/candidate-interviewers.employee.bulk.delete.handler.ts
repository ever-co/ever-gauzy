import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateInterviewersEmployeeBulkDeleteCommand } from '../candidate-interviewers.employee.bulk.delete.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';

@CommandHandler(CandidateInterviewersEmployeeBulkDeleteCommand)
export class CandidateInterviewersEmployeeBulkDeleteHandler implements ICommandHandler<CandidateInterviewersEmployeeBulkDeleteCommand> {
	constructor(private readonly candidateInterviewersService: CandidateInterviewersService) {}

	public async execute(command: CandidateInterviewersEmployeeBulkDeleteCommand): Promise<void> {
		const { deleteInput } = command;

		if (!deleteInput?.length) {
			return;
		}

		// Fetch all interviewers in parallel
		const interviewerGroups = await Promise.all(
			deleteInput.map((employeeId) => this.candidateInterviewersService.getInterviewersByEmployeeId(employeeId))
		);

		// Flatten results
		const interviewerIds = interviewerGroups.flat().map((interviewer) => interviewer.id);

		if (!interviewerIds.length) {
			return;
		}

		await this.candidateInterviewersService.deleteMany(interviewerIds);
	}
}
