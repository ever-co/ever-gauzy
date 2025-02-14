import { HttpStatus, HttpException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IReaction } from '@gauzy/contracts';
import { ReactionService } from '../../reaction.service';
import { ReactionCreateCommand } from '../reaction.create.command';

@CommandHandler(ReactionCreateCommand)
export class ReactionCreateHandler implements ICommandHandler<ReactionCreateCommand> {
	constructor(private readonly reactionService: ReactionService) {}

	/**
	 * Executes the ReactionCreateCommand to create a reaction.
	 * If an error occurs, logs the error and rethrows it.
	 *
	 * @param command - The command object containing the reaction creation input.
	 * @returns A Promise that resolves to the created reaction.
	 */
	public async execute(command: ReactionCreateCommand): Promise<IReaction> {
		try {
			const { input } = command;
			return await this.reactionService.create(input);
		} catch (error) {
			console.log('[ReactionExecute] Error while executing ReactionCreateCommand:', error);
			throw new HttpException(
				`Error while executing ReactionCreateCommand: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
