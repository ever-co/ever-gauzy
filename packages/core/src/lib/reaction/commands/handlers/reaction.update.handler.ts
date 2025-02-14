import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IReaction } from '@gauzy/contracts';
import { ReactionService } from '../../reaction.service';
import { ReactionUpdateCommand } from '../reaction.update.command';

@CommandHandler(ReactionUpdateCommand)
export class ReactionUpdateHandler implements ICommandHandler<ReactionUpdateCommand> {
	constructor(private readonly reactionService: ReactionService) {}

	/**
	 * Executes the ReactionUpdateCommand to update a reaction.
	 *
	 * @param command - The command object containing the reaction update details.
	 * @returns A Promise that resolves to the updated reaction or an UpdateResult.
	 */
	public async execute(command: ReactionUpdateCommand): Promise<IReaction | UpdateResult> {
		try {
			const { id, input } = command;
			return await this.reactionService.update(id, input);
		} catch (error) {
			console.error('[ReactionUpdate] Error while updating reaction:', error);
			throw new HttpException(
				`Error while executing ReactionUpdateCommand: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
