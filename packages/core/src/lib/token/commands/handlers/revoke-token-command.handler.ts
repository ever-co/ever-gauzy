import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IJwtService } from '../../interfaces/jwt-service.interface';
import { TokenStatus } from '../../interfaces';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { JwtServiceToken, TokenReadRepositoryToken, TokenWriteRepositoryToken, resolveRawToken } from '../../shared';
import { RevokeTokenCommand } from '../revoke-token.command';

@CommandHandler(RevokeTokenCommand)
export class RevokeTokenHandler implements ICommandHandler<RevokeTokenCommand, void> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		@Inject(JwtServiceToken)
		private readonly jwtService: IJwtService
	) {}

	async execute(command: RevokeTokenCommand): Promise<void> {
		const { dto } = command;
		const rawToken = resolveRawToken(dto);
		const tokenDigest = this.jwtService.hashToken(rawToken);

		const token = await this.tokenReadRepository.findByHash(tokenDigest);

		if (!token) {
			throw new NotFoundException('Token not found');
		}

		if (!token.canRotate()) {
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
