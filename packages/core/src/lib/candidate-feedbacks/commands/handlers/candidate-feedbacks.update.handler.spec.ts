import '../../../core/entities/internal';

import { FeedbackUpdateCommand } from '../candidate-feedbacks.update.command';
import { FeedbackUpdateHandler } from './candidate-feedbacks.update.handler';

/**
 * Editing a feedback recomputes its interview's rating. The handler read the interview only from the nested
 * `interviewer.interviewId`, while the REST body (`PUT /candidate-feedbacks/:id`) carries a flat
 * `interviewId`, so a REST edit left the interview rating stale.
 */
describe('FeedbackUpdateHandler', () => {
	const run = async (entity: Record<string, unknown>, stored: Record<string, unknown> = {}) => {
		const candidateFeedbackService = {
			// As TypeORM's save: the entity built from the supplied fields only, not the full stored row
			create: jest.fn(async (input) => ({ ...input })),
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'feedback-1', ...stored }),
			getFeedbacksByInterviewId: jest.fn().mockResolvedValue([{ rating: 4 }, { rating: 2 }]),
			calcRating: jest.fn().mockReturnValue(3)
		};
		const candidateInterviewService = { create: jest.fn() };
		const handler = new FeedbackUpdateHandler(candidateFeedbackService as any, candidateInterviewService as any);

		await handler.execute(new FeedbackUpdateCommand('feedback-1', entity as any));

		return { candidateFeedbackService, candidateInterviewService };
	};

	it('recomputes the rating of the interview named by the flat interviewId (REST)', async () => {
		const { candidateFeedbackService, candidateInterviewService } = await run({
			interviewId: 'interview-1',
			rating: 2
		});

		expect(candidateFeedbackService.getFeedbacksByInterviewId).toHaveBeenCalledWith('interview-1');
		expect(candidateInterviewService.create).toHaveBeenCalledWith({ id: 'interview-1', rating: 3 });
	});

	it('still reads the nested interviewer.interviewId (GraphQL)', async () => {
		const { candidateInterviewService } = await run({ interviewer: { interviewId: 'interview-2' }, rating: 2 });

		expect(candidateInterviewService.create).toHaveBeenCalledWith({ id: 'interview-2', rating: 3 });
	});

	it("falls back to the stored feedback's interview when the edit names none", async () => {
		const { candidateFeedbackService, candidateInterviewService } = await run(
			{ description: 'Strong', rating: 2 },
			{ interviewId: 'interview-3' }
		);

		expect(candidateFeedbackService.findOneByIdString).toHaveBeenCalledWith('feedback-1');

		expect(candidateInterviewService.create).toHaveBeenCalledWith({ id: 'interview-3', rating: 3 });
	});
});
