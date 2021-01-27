import { ICommand } from '@nestjs/cqrs';
import { ICandidateFeedback } from '@gauzy/contracts';

export class FeedbackUpdateCommand implements ICommand {
	static readonly type = '[Feedback] Update';

	constructor(
		public readonly id: string,
		public readonly entity: ICandidateFeedback
	) {}
}
