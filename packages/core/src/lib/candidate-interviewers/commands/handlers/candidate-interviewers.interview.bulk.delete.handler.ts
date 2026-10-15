import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { CandidateInterviewersService } from '../../candidate-interviewers.service';
import { CandidateInterviewersInterviewBulkDeleteCommand } from '../candidate-interviewers.interview.bulk.delete.command';

@CommandHandler(CandidateInterviewersInterviewBulkDeleteCommand)
export class CandidateInterviewersInterviewBulkDeleteHandler implements ICommandHandler<CandidateInterviewersInterviewBulkDeleteCommand> {
	constructor(private readonly candidateInterviewersService: CandidateInterviewersService) {}

	/**
	 * Clears one sitting's panel.
	 *
	 * @returns The delete result, so a caller can tell a panel that was cleared from one that was already
	 * empty (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: CandidateInterviewersInterviewBulkDeleteCommand): Promise<DeleteResult> {
		const { id: interviewId } = command;

		const interviewers = await this.candidateInterviewersService.getInterviewersByInterviewId(interviewId);

		if (!interviewers?.length) {
			return { affected: 0, raw: [] };
		}

		const interviewerIds = interviewers.map((i) => i.id);

		return await this.candidateInterviewersService.deleteMany(interviewerIds);
	}
}
