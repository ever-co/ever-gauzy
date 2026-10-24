import { BadRequestException, HttpException } from '@nestjs/common';
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
	 * to create a comment. An HTTP error of the service is rethrown as is; any other error is logged and a
	 * BadRequestException is thrown.
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
			// Keep the service's own HTTP errors (status and message) instead of wrapping them in a new 400
			if (error instanceof HttpException) {
				throw error;
			}
			console.log(`Error while creating comment: ${error.message}`, error);
			throw new BadRequestException('Comment post failed', error);
		}
	}
}
