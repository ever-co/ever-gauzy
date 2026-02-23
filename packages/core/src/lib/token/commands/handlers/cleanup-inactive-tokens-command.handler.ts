import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITokenMaintenanceRepository } from '../../interfaces/token-repository.interface';
import { TokenMaintenanceRepositoryToken } from '../../shared/token-repository.token';
import { CleanupInactiveTokensCommand } from '../cleanup-inactive-tokens.command';

@CommandHandler(CleanupInactiveTokensCommand)
export class CleanupInactiveTokensHandler implements ICommandHandler<CleanupInactiveTokensCommand, number> {
	constructor(
		@Inject(TokenMaintenanceRepositoryToken)
		private readonly tokenRepository: ITokenMaintenanceRepository
	) {}

	async execute(command: CleanupInactiveTokensCommand): Promise<number> {
		return this.tokenRepository.revokeInactiveTokens(command.tokenType, command.threshold);
	}
}
