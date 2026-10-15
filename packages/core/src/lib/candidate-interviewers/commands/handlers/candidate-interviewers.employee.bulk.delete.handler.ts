import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult, In } from 'typeorm';
import { CandidateInterviewersEmployeeBulkDeleteCommand } from '../candidate-interviewers.employee.bulk.delete.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';

@CommandHandler(CandidateInterviewersEmployeeBulkDeleteCommand)
export class CandidateInterviewersEmployeeBulkDeleteHandler implements ICommandHandler<CandidateInterviewersEmployeeBulkDeleteCommand> {
	constructor(private readonly candidateInterviewersService: CandidateInterviewersService) {}

	/**
	 * Execute the command to delete interviewers by employee ID.
	 *
	 * @returns The delete result, so a caller can tell seats that were removed from a call that matched
	 * none (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: CandidateInterviewersEmployeeBulkDeleteCommand): Promise<DeleteResult> {
		const { input } = command;
		const nothing: DeleteResult = { affected: 0, raw: [] };

		if (!input?.length) {
			return nothing;
		}

		// Extract employee IDs from input
		const employeeIds = input.map(({ employeeId }) => employeeId).filter((id) => !!id);

		if (!employeeIds.length) {
			return nothing;
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
			return nothing;
		}

		return await this.candidateInterviewersService.deleteMany(interviewerIds);
	}
}
