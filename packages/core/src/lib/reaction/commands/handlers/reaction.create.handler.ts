import { HttpStatus, HttpException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ActorTypeEnum, IReaction } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context/request-context';
import { ReactionService } from '../../reaction.service';
import { ReactionCreateCommand } from '../reaction.create.command';

@CommandHandler(ReactionCreateCommand)
export class ReactionCreateHandler implements ICommandHandler<ReactionCreateCommand> {
	constructor(private readonly reactionService: ReactionService) {}

	/**
	 * Executes the ReactionCreateCommand to create a new reaction.
	 * It extracts necessary properties from the command input and the current request context,
	 * then delegates the creation process to the reactionService.
	 *
	 * @param command - The command containing the reaction creation input.
	 * @returns A Promise resolving to the newly created reaction.
	 * @throws HttpException with BAD_REQUEST status if reaction creation fails.
	 */
	public async execute(command: ReactionCreateCommand): Promise<IReaction> {
		try {
			const { input } = command;
			// Resolve tenantId from the current request context, or fall back to the input tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

			// Destructure the required properties from the input
			const { organizationId, entity, entityId, emoji } = input;

			// Delegate reaction creation to the reactionService
			return await this.reactionService.create({
				entity,
				entityId,
				emoji,
				actorType: ActorTypeEnum.User,
				organizationId,
				tenantId
			});
		} catch (error) {
			console.log('[ReactionExecute] Error while executing ReactionCreateCommand:', error);
			throw new HttpException(
				`Error while executing ReactionCreateCommand: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
