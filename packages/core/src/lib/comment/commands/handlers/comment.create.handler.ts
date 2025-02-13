import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IComment } from '@gauzy/contracts';
import { CommentService } from '../../comment.service';
import { CommentCreateCommand } from '../comment.create.command';

@CommandHandler(CommentCreateCommand)
export class CommentCreateHandler implements ICommandHandler<CommentCreateCommand> {
	constructor(readonly commentService: CommentService) {}

	/**
	 * Executes the CommentCreateCommand to create a new comment.
	 *
	 * This function extracts the input data from the provided command and invokes the comment service
	 * to create a comment. If an error occurs during the process, it logs the error and throws a
	 * BadRequestException.
	 *
	 * @param {CommentCreateCommand} command - The command containing the input data for creating the comment.
	 * @returns {Promise<IComment>} A promise that resolves to the newly created comment.
	 * @throws {BadRequestException} If the comment creation fails.
	 */
	public async execute(command: CommentCreateCommand): Promise<IComment> {
		try {
			const { input } = command;
			return await this.commentService.create(input);
		} catch (error) {
			console.log(`Error while creating comment: ${error.message}`, error);
			throw new BadRequestException('Comment post failed', error);
		}
	}
}
