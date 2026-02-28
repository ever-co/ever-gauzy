import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITokenMaintenanceRepository } from '../../interfaces/token-repository.interface';
import { TokenMaintenanceRepositoryToken } from '../../shared/token-repository.token';
import { CleanupExpiredTokensCommand } from '../cleanup-expired-tokens.command';

@CommandHandler(CleanupExpiredTokensCommand)
export class CleanupExpiredTokensHandler implements ICommandHandler<CleanupExpiredTokensCommand, number> {
	constructor(
		@Inject(TokenMaintenanceRepositoryToken)
		private readonly tokenRepository: ITokenMaintenanceRepository
	) {}

	async execute(command: CleanupExpiredTokensCommand): Promise<number> {
		return this.tokenRepository.markExpiredTokens();
	}
}
