import { isBetterSqlite3 } from '@gauzy/config';
import { BadRequestException, ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { IGeneratedToken } from '../../interfaces/token.interface';
import { TokenWriteRepositoryToken } from '../../shared';
import { TokenHasher } from '../../shared/token-hasher';
import { TokenConfigRegistry } from '../../token-config.registry';
import { RotateTokenCommand } from '../rotate-token.command';

@CommandHandler(RotateTokenCommand)
export class RotateTokenHandler implements ICommandHandler<RotateTokenCommand, IGeneratedToken> {
	constructor(
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenRepository: ITokenWriteRepository,
		private readonly configRegistry: TokenConfigRegistry,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(command: RotateTokenCommand): Promise<IGeneratedToken> {
		const { dto } = command;

		if (!dto.rawOldToken) {
			throw new BadRequestException('rawOldToken is required');
		}

		const config = this.configRegistry.getConfig(dto.tokenType);
		const jwtService = this.configRegistry.getJwtService(dto.tokenType);

		if (!config.allowRotation) {
			throw new ConflictException(`Token type ${dto.tokenType} does not support rotation`);
		}

		// Use pessimistic locking for atomic rotation
		const rawOldToken = dto.rawOldToken;
		const oldTokenDigest = this.tokenHasher.hashToken(rawOldToken);

		return this.tokenRepository.transaction(async (repository: ITokenReadRepository & ITokenWriteRepository) => {
			const oldToken = await repository.findByHashWithLock(oldTokenDigest);

			if (!oldToken) {
				throw new NotFoundException('Token not found');
			}

			if (!oldToken.isActivated()) {
				throw new ConflictException('Token is not active');
			}

			if (!oldToken.canRotate()) {
				throw new ConflictException('Token cannot be rotated');
			}

			if (oldToken.userId !== dto.userId) {
				throw new ConflictException('Token does not belong to user');
			}

			if (oldToken.tokenType !== dto.tokenType) {
				throw new ConflictException('Token type mismatch');
			}

			if (!config.allowMultipleSessions) {
				const activeTokens = await repository.findActiveByUserAndType(dto.userId, dto.tokenType);
				const activeTokensToRevoke = activeTokens.filter((token) => token.id !== oldToken.id);

				for (const token of activeTokensToRevoke) {
					await repository.updateStatus(token.id, TokenStatus.REVOKED, token.version, {
						revokedReason: 'Token rotated - single session only'
					});
				}
			}

			// Calculate expiration for new token
			const expiresAt = config.expiration ? new Date(Date.now() + config.expiration) : null;

			// Metadata can come from the DTO (for client-provided metadata) or be copied from the old token if not provided
			const metadata = dto.metadata || oldToken.metadata;

			// Create new token
			const newTokenRecord = await repository.create({
				...(metadata && { metadata }),
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenHash: '',
				status: TokenStatus.ACTIVE,
				expiresAt,
				rotatedFromTokenId: oldToken.id,
				lastUsedAt: new Date()
			});

			// Parse metadata for SQLite
			const parsedMetadata = isBetterSqlite3()
				? JSON.parse(newTokenRecord.metadata as string)
				: newTokenRecord.metadata;

			// Generate new JWT
			const payload = {
				...parsedMetadata,
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenId: newTokenRecord.id
			};

			const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : undefined;
			const expiresInSeconds = expiresInMs ? Math.max(1, Math.ceil(expiresInMs / 1000)) : undefined;
			const jwt = await jwtService.sign(payload, expiresInSeconds);
			const tokenHash = this.tokenHasher.hashToken(jwt);

			// Update new token with hash
			newTokenRecord.tokenHash = tokenHash;
			await repository.save(newTokenRecord);

			// Mark old token as rotated
			const updated = await repository.updateStatus(oldToken.id, TokenStatus.ROTATED, oldToken.version, {
				rotatedToTokenId: newTokenRecord.id
			});

			if (!updated) {
				throw new ConflictException('Failed to rotate token - concurrent modification');
			}

			return {
				token: jwt,
				tokenId: newTokenRecord.id,
				expiresAt: newTokenRecord.expiresAt,
				createdAt: newTokenRecord.createdAt
			};
		});
	}
}
