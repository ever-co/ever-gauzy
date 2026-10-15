import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { FeedbackDeleteCommand } from '../candidate-feedbacks.delete.command';
import { CandidateFeedbacksService } from '../../candidate-feedbacks.service';
import { CandidateInterviewService } from '../../../candidate-interview/candidate-interview.service';

@CommandHandler(FeedbackDeleteCommand)
export class FeedbackDeleteHandler implements ICommandHandler<FeedbackDeleteCommand> {
	constructor(
		private readonly candidateFeedbackService: CandidateFeedbacksService,
		private readonly candidateInterviewService: CandidateInterviewService
	) {}

	/**
	 * Removes one verdict and recomputes the sitting's average from the verdicts that remain.
	 *
	 * @returns The verdict's delete result, so a caller can tell a removal from an identifier that named
	 * no verdict (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: FeedbackDeleteCommand): Promise<DeleteResult> {
		const { feedbackId, interviewId } = command;
		const feedback = await this.delete(feedbackId);

		if (feedback && interviewId) {
			const id = interviewId;
			const feedbacks = await this.candidateFeedbackService.getFeedbacksByInterviewId(id);
			let interviewRating: number;
			if (feedbacks.length > 0) {
				interviewRating = this.candidateFeedbackService.calcRating(feedbacks);
				await this.candidateInterviewService.create({
					id: id,
					rating: interviewRating
				});
			} else {
				await this.candidateInterviewService.create({
					id: id,
					rating: 0
				});
			}
		}

		return feedback;
	}

	public async delete(id: string): Promise<DeleteResult> {
		return this.candidateFeedbackService.delete(id);
	}
}
