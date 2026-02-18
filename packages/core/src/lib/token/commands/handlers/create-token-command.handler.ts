import { isBetterSqlite3 } from '@gauzy/config';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenStatus } from '../../interfaces';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { IGeneratedToken } from '../../interfaces/token.interface';
import { TokenWriteRepositoryToken } from '../../shared';
import { TokenHasher } from '../../shared/token-hasher';
import { TokenConfigRegistry } from '../../token-config.registry';
import { CreateTokenCommand } from '../create-token.command';

@CommandHandler(CreateTokenCommand)
export class CreateTokenHandler implements ICommandHandler<CreateTokenCommand, IGeneratedToken> {
	constructor(
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		private readonly configRegistry: TokenConfigRegistry,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(command: CreateTokenCommand): Promise<IGeneratedToken> {
		const { dto } = command;
		const config = this.configRegistry.getConfig(dto.tokenType);
		const jwtService = this.configRegistry.getJwtService(dto.tokenType);

		// Calculate expiration
		const expiresAt = dto.expiresAt || (config.expiration ? new Date(Date.now() + config.expiration) : null);

		// Wrap creation and update in a transaction
		return await this.tokenWriteRepository.transaction(async (manager) => {
			// Single-session token types must revoke any currently active tokens atomically.
			if (!config.allowMultipleSessions) {
				await manager.revokeAllByUserAndType(
					dto.userId,
					dto.tokenType,
					null,
					'New token created - single session only'
				);
			}

			// Handle metadata serialization for SQLite
			const metadata = isBetterSqlite3() ? JSON.stringify(dto.metadata) : dto.metadata;

			// Create token record first (without JWT)
			const tokenRecord = await manager.create({
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenHash: '', // Temporary, will update
				status: TokenStatus.ACTIVE,
				expiresAt,
				metadata,
				lastUsedAt: new Date()
			});

			// Generate JWT with tokenId
			const payload = {
				...dto.metadata,
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenId: tokenRecord.id
			};

			const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : undefined;
			const expiresInSeconds = expiresInMs ? Math.max(1, Math.ceil(expiresInMs / 1000)) : undefined;
			const jwt = await jwtService.sign(payload, expiresInSeconds);
			const tokenHash = this.tokenHasher.hashToken(jwt);

			// Update token with hash
			tokenRecord.tokenHash = tokenHash;
			await manager.save(tokenRecord);

			return {
				token: jwt,
				tokenId: tokenRecord.id,
				expiresAt: tokenRecord.expiresAt,
				createdAt: tokenRecord.createdAt
			};
		});
	}
}
