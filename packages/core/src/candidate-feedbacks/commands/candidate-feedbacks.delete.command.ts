import { ICommand } from '@nestjs/cqrs';

export class FeedbackDeleteCommand implements ICommand {
	static readonly type = '[Feedback] Delete';

	constructor(
		public readonly feedbackId: string,
		public readonly interviewId: string
	) {}
}
