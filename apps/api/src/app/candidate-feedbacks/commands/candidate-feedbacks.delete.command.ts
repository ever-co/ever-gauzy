import { ICommand } from '@nestjs/cqrs';

export class FeedbackDeleteCommand implements ICommand {
	static readonly type = '[Feedback] Delete';

	constructor(
		public readonly interviewId: string,
		public readonly feedbackId: string
	) {}
}
