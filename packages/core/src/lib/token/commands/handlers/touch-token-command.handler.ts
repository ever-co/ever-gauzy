import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { TokenWriteRepositoryToken } from '../../shared';
import { TouchTokenCommand } from '../touch-token.command';

/** Sets a stored token's last use to now (and counts the use), as a validation does. */
@CommandHandler(TouchTokenCommand)
export class TouchTokenHandler implements ICommandHandler<TouchTokenCommand, void> {
	constructor(
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository
	) {}

	async execute(command: TouchTokenCommand): Promise<void> {
		await this.tokenWriteRepository.updateLastUsed(command.tokenId);
	}
}
