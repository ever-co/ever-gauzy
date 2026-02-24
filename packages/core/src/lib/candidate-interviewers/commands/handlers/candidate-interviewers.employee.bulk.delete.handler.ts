import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { CandidateInterviewersEmployeeBulkDeleteCommand } from '../candidate-interviewers.employee.bulk.delete.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';

@CommandHandler(CandidateInterviewersEmployeeBulkDeleteCommand)
export class CandidateInterviewersEmployeeBulkDeleteHandler implements ICommandHandler<CandidateInterviewersEmployeeBulkDeleteCommand> {
	constructor(private readonly candidateInterviewersService: CandidateInterviewersService) {}

	/**
	 * Execute the command to delete interviewers by employee ID.
	 */
	public async execute(command: CandidateInterviewersEmployeeBulkDeleteCommand): Promise<void> {
		const { input } = command;

		if (!input?.length) {
			return;
		}

		// Extract employee IDs from input
		const employeeIds = input.map(({ employeeId }) => employeeId).filter((id) => !!id);

		if (!employeeIds.length) {
			return;
		}

		// Fetch all interviewers for the given employee IDs in a single query
		const interviewers = await this.candidateInterviewersService.find({
			where: {
				employeeId: In(employeeIds)
			}
		});

		// Extract interviewer IDs
		const interviewerIds = interviewers.map((interviewer) => interviewer.id);

		if (!interviewerIds.length) {
			return;
		}

		await this.candidateInterviewersService.deleteMany(interviewerIds);
	}
}
