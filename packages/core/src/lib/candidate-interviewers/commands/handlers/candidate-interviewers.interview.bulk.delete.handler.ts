import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';
import { CandidateInterviewersInterviewBulkDeleteCommand } from '../candidate-interviewers.interview.bulk.delete.command';

@CommandHandler(CandidateInterviewersInterviewBulkDeleteCommand)
export class CandidateInterviewersInterviewBulkDeleteHandler implements ICommandHandler<CandidateInterviewersInterviewBulkDeleteCommand> {
	constructor(private readonly candidateInterviewersService: CandidateInterviewersService) {}

	public async execute(command: CandidateInterviewersInterviewBulkDeleteCommand): Promise<void> {
		const { id: interviewId } = command;

		const interviewers = await this.candidateInterviewersService.getInterviewersByInterviewId(interviewId);

		if (!interviewers?.length) {
			return;
		}

		const interviewerIds = interviewers.map((i) => i.id);

		await this.candidateInterviewersService.deleteMany(interviewerIds);
	}
}
