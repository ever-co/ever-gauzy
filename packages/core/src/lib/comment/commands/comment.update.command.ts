import { ICommand } from '@nestjs/cqrs';
import { ICommentUpdateInput, ID } from '@gauzy/contracts';

export class CommentUpdateCommand implements ICommand {
	static readonly type = '[Comment] Update';

	constructor(public readonly id: ID, public readonly input: ICommentUpdateInput) {}
}
