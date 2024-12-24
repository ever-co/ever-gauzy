import { ICommand } from '@nestjs/cqrs';
import { ICommentCreateInput } from '@gauzy/contracts';

export class CommentCreateCommand implements ICommand {
	static readonly type = '[Comment] Create';

	constructor(public readonly input: ICommentCreateInput) {}
}
