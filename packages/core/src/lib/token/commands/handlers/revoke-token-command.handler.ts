import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { TokenReadRepositoryToken, TokenWriteRepositoryToken } from '../../shared';
import { TokenHasher } from '../../shared/token-hasher';
import { tokenWithRules } from '../../shared/token-rules';
import { RevokeTokenCommand } from '../revoke-token.command';

@CommandHandler(RevokeTokenCommand)
export class RevokeTokenHandler implements ICommandHandler<RevokeTokenCommand, void> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(command: RevokeTokenCommand): Promise<void> {
		const { dto } = command;
		const rawToken = dto.rawToken;
		const tokenDigest = this.tokenHasher.hashToken(rawToken);

		const stored = await this.tokenReadRepository.findByHash(tokenDigest);

		if (!stored) {
			throw new NotFoundException('Token not found');
		}

		// The rule is the record's own method; a MikroORM read answers the row without it, see `tokenWithRules`.
		const token = tokenWithRules(stored);

		if (!token.canRevoke()) {
			return; // Already revoked/expired
		}

		const updated = await this.tokenWriteRepository.updateStatus(token.id, TokenStatus.REVOKED, token.version, {
			revokedById: dto.revokedById,
			revokedReason: dto.reason
		});

		if (!updated) {
			throw new ConflictException('Failed to revoke token - concurrent modification');
		}
	}
}
