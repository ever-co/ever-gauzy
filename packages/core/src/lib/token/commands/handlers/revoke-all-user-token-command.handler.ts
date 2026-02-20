import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { TokenWriteRepositoryToken } from '../../shared';
import { RevokeAllUserTokensCommand } from '../revoke-all-user-token.command';

@CommandHandler(RevokeAllUserTokensCommand)
export class RevokeAllUserTokensHandler implements ICommandHandler<RevokeAllUserTokensCommand, number> {
	constructor(
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenRepository: ITokenWriteRepository
	) {}

	async execute(command: RevokeAllUserTokensCommand): Promise<number> {
		return this.tokenRepository.revokeAllByUserAndType(
			command.userId,
			command.tokenType,
			command.revokedById,
			command.reason
		);
	}
}
