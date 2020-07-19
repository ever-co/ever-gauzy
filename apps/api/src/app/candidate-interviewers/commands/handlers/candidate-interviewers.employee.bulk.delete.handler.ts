import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateInterviewersEmployeeBulkDeleteCommand } from '../candidate-interviewers.employee.bulk.delete.command';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';

@CommandHandler(CandidateInterviewersEmployeeBulkDeleteCommand)
export class CandidateInterviewersEmployeeBulkDeleteHandler
	implements ICommandHandler<CandidateInterviewersEmployeeBulkDeleteCommand> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService
	) {}

	public async execute(
		command: CandidateInterviewersEmployeeBulkDeleteCommand
	): Promise<any> {
		const { deleteInput } = command;
		for (const id of deleteInput) {
			const interviewers = await this.candidateInterviewersService.getInterviewersByEmployeeId(
				id
			);
			await this.candidateInterviewersService.deleteBulk(
				interviewers.map((item) => item.id)
			);
		}

		return;
	}
}
