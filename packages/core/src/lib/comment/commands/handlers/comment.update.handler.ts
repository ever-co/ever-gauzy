import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { CommentService } from '../../comment.service';
import { CommentUpdateCommand } from '../comment.update.command';
import { IComment } from '@gauzy/contracts';

@CommandHandler(CommentUpdateCommand)
export class CommentUpdateHandler implements ICommandHandler<CommentUpdateCommand> {
	constructor(private readonly commentService: CommentService) {}

	public async execute(command: CommentUpdateCommand): Promise<IComment | UpdateResult> {
		const { id, input } = command;
		return await this.commentService.update(id, input);
	}
}
