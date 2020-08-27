import { CandidateFeedback } from './../../candidate-feedbacks.entity';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeedbackUpdateCommand } from '../candidate-feedbacks.update.command';
import { CandidateFeedbacksService } from '../../candidate-feedbacks.service';
import { CandidateInterviewService } from '../../../candidate-interview/candidate-interview.service';
import { ICandidateFeedback } from '@gauzy/models';

@CommandHandler(FeedbackUpdateCommand)
export class FeedbackUpdateHandler
	implements ICommandHandler<FeedbackUpdateCommand> {
	constructor(
		private readonly candidateFeedbackService: CandidateFeedbacksService,
		private readonly candidateInterviewService: CandidateInterviewService
	) {}

	public async execute(command: FeedbackUpdateCommand): Promise<any> {
		const { id } = command;
		const { entity } = command;

		const feedback = await this.updateFeedback(id['id'], entity);
		const interviewId = entity.interviewer.interviewId;

		if (feedback) {
			const feedbacks = await this.candidateFeedbackService.getFeedbacksByInterviewId(
				interviewId
			);
			let interviewRating: number;

			if (feedbacks.length > 0) {
				interviewRating = this.candidateFeedbackService.calcRating(
					feedbacks
				);
				await this.candidateInterviewService.create({
					id: interviewId,
					rating: interviewRating
				});
			}
			return feedback;
		}
	}
	public async updateFeedback(
		id: string,
		entity: ICandidateFeedback
	): Promise<CandidateFeedback> {
		return this.candidateFeedbackService.create({ id: id, ...entity });
	}
}
