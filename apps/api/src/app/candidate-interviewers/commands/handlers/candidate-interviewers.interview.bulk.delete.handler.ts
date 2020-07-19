import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';
import { CandidateInterviewersInterviewBulkDeleteCommand } from '../candidate-interviewers.interview.bulk.delete.command';

@CommandHandler(CandidateInterviewersInterviewBulkDeleteCommand)
export class CandidateInterviewersInterviewBulkDeleteHandler
	implements
		ICommandHandler<CandidateInterviewersInterviewBulkDeleteCommand> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService
	) {}

	public async execute(
		command: CandidateInterviewersInterviewBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const interviewers = await this.candidateInterviewersService.getInterviewersByInterviewId(
			id
		);
		await this.candidateInterviewersService.deleteBulk(
			interviewers.map((item) => item.id)
		);

		return;
	}
}
