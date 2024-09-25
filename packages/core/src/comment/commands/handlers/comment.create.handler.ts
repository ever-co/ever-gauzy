import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IComment } from '@gauzy/contracts';
import { CommentService } from '../../comment.service';
import { CommentCreateCommand } from '../comment.create.command';

@CommandHandler(CommentCreateCommand)
export class CommentCreateHandler implements ICommandHandler<CommentCreateCommand> {
	constructor(private readonly commentService: CommentService) {}

	public async execute(command: CommentCreateCommand): Promise<IComment> {
		const { input } = command;
		return await this.commentService.create(input);
	}
}
