import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICandidateFeedback, ICandidateFeedbackCreateInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { FeedbackUpdateCommand } from '../candidate-feedbacks.update.command';
import { CandidateFeedbacksService } from '../../candidate-feedbacks.service';
import { CandidateInterviewService } from '../../../candidate-interview/candidate-interview.service';

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
		const feedback = await this.update(id, entity);
		if (feedback) {
			const interviewId = entity.interviewer ? entity.interviewer.interviewId : null;
			if (interviewId) {
				const feedbacks = await this.candidateFeedbackService.getFeedbacksByInterviewId(
					interviewId
				);
				let interviewRating: number;
				if (isNotEmpty(feedbacks)) {
					interviewRating = this.candidateFeedbackService.calcRating(
						feedbacks
					);
					await this.candidateInterviewService.create({
						id: interviewId,
						rating: interviewRating
					});
				}
			}
			return feedback;
		}
	}

	public async update(
		id: string,
		entity: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.candidateFeedbackService.create({ 
			id, 
			...entity
		});
	}
}
