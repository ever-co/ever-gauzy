import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { IGeneratedToken } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken, TokenWriteRepositoryToken } from '../../shared';
import { TokenConfigRegistry } from '../../token-config.registry';
import { CreateTokenCommand } from '../create-token.command';

@CommandHandler(CreateTokenCommand)
export class CreateTokenHandler implements ICommandHandler<CreateTokenCommand, IGeneratedToken> {
	constructor(
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		private readonly configRegistry: TokenConfigRegistry
	) {}

	async execute(command: CreateTokenCommand): Promise<IGeneratedToken> {
		const { dto } = command;
		const config = this.configRegistry.getConfig(dto.tokenType);
		const jwtService = this.configRegistry.getJwtService(dto.tokenType);

		// Check if multiple sessions are allowed
		if (!config.allowMultipleSessions) {
			const activeTokens = await this.tokenReadRepository.findActiveByUserAndType(dto.userId, dto.tokenType);

			if (activeTokens.length > 0) {
				// Revoke existing tokens
				await this.tokenWriteRepository.revokeAllByUserAndType(
					dto.userId,
					dto.tokenType,
					null,
					'New token created - single session only'
				);
			}
		}

		// Calculate expiration
		const expiresAt = dto.expiresAt || (config.expiration ? new Date(Date.now() + config.expiration) : null);

		// Create token record first (without JWT)
		const tokenRecord = await this.tokenWriteRepository.create({
			userId: dto.userId,
			tokenType: dto.tokenType,
			tokenHash: '', // Temporary, will update
			status: TokenStatus.ACTIVE,
			expiresAt,
			metadata: dto.metadata,
			lastUsedAt: new Date()
		});

		// Generate JWT with tokenId
		const payload = {
			userId: dto.userId,
			tokenType: dto.tokenType,
			tokenId: tokenRecord.id,
			...dto.metadata
		};

		const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : undefined;
		const expiresInSeconds = expiresInMs ? Math.max(1, Math.ceil(expiresInMs / 1000)) : undefined;
		const jwt = jwtService.sign(payload, expiresInSeconds);
		const tokenHash = jwtService.hashToken(jwt);

		// Update token with hash
		tokenRecord.tokenHash = tokenHash;
		await this.tokenWriteRepository.save(tokenRecord);

		return {
			token: jwt,
			tokenId: tokenRecord.id,
			expiresAt: tokenRecord.expiresAt,
			createdAt: tokenRecord.createdAt
		};
	}
}
