import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommentService } from '../../comment.service';
import { CommentUpdateCommand } from '../comment.update.command';
import { IComment } from '@gauzy/contracts';

@CommandHandler(CommentUpdateCommand)
export class CommentUpdateHandler implements ICommandHandler<CommentUpdateCommand> {
	constructor(private readonly commentService: CommentService) {}

	public async execute(command: CommentUpdateCommand): Promise<IComment> {
		const { input } = command;
		const { id } = input;
		return await this.commentService.create({
			...input,
			id
		});
	}
}
