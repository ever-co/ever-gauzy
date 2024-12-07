import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReactionService } from '../../reaction.service';
import { ReactionCreateCommand } from '../reaction.create.command';
import { IReaction } from '@gauzy/contracts';

@CommandHandler(ReactionCreateCommand)
export class ReactionCreateHandler implements ICommandHandler<ReactionCreateCommand> {
	constructor(private readonly reactionService: ReactionService) {}

	public async execute(command: ReactionCreateCommand): Promise<IReaction> {
		const { input } = command;
		return await this.reactionService.create(input);
	}
}
