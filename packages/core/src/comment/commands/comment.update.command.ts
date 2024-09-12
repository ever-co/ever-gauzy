import { ICommand } from '@nestjs/cqrs';
import { ICommentUpdateInput } from '@gauzy/contracts';

export class CommentUpdateCommand implements ICommand {
	static readonly type = '[Comment] Update';

	constructor(public readonly input: ICommentUpdateInput) {}
}
