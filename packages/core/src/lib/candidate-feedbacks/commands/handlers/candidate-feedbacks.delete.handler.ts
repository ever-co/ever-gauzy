import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeedbackDeleteCommand } from '../candidate-feedbacks.delete.command';
import { CandidateFeedbacksService } from '../../candidate-feedbacks.service';
import { CandidateInterviewService } from '../../../candidate-interview/candidate-interview.service';

@CommandHandler(FeedbackDeleteCommand)
export class FeedbackDeleteHandler implements ICommandHandler<FeedbackDeleteCommand> {
	constructor(
		private readonly candidateFeedbackService: CandidateFeedbacksService,
		private readonly candidateInterviewService: CandidateInterviewService
	) {}

	public async execute(command: FeedbackDeleteCommand): Promise<any> {
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
			return;
		}
	}

	public async delete(id: string): Promise<any> {
		return this.candidateFeedbackService.delete(id);
	}
}
