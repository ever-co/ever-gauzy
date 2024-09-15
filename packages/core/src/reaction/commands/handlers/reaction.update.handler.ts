import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { ReactionService } from '../../reaction.service';
import { ReactionUpdateCommand } from '../reaction.update.command';
import { IReaction } from '@gauzy/contracts';

@CommandHandler(ReactionUpdateCommand)
export class ReactionUpdateHandler implements ICommandHandler<ReactionUpdateCommand> {
	constructor(private readonly reactionService: ReactionService) {}

	public async execute(command: ReactionUpdateCommand): Promise<IReaction | UpdateResult> {
		const { id, input } = command;
		return await this.reactionService.update(id, input);
	}
}
