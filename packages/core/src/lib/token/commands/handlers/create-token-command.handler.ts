import { Inject, InternalServerErrorException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
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
	private readonly logger = new Logger(CreateTokenHandler.name);

	constructor(
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		private readonly configRegistry: TokenConfigRegistry,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(command: CreateTokenCommand): Promise<IGeneratedToken> {
		const { dto } = command;

		// Resolve config & JWT service up-front so misconfigured types fail fast,
		// before any database work begins.
		const config = this.configRegistry.getConfig(dto.tokenType);
		const jwtService = this.configRegistry.getJwtService(dto.tokenType);

		// Honour the explicit expiry from the DTO; fall back to the type-level
		// configuration; null means the token never expires.
		const expiresAt: Date | null =
			dto.expiresAt ?? (config.expiration ? new Date(Date.now() + config.expiration) : null);

		return this.tokenWriteRepository.transaction(async (manager) => {
			// Single-session enforcement: atomically revoke every other active
			// token of this type for the user before issuing the new one.
			if (!config.allowMultipleSessions) {
				this.logger.debug(
					`Single-session mode active — revoking existing tokens for user=${dto.userId} type=${dto.tokenType}`
				);

				await manager.revokeAllByUserAndType(
					dto.userId,
					dto.tokenType,
					null, // revokedById — system-initiated
					'New token created - single session only'
				);
			}

			// Step 1: Persist a placeholder record so we obtain a stable tokenId
			// that can be embedded in the JWT payload.
			const tokenRecord = await manager.create({
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenHash: randomUUID(), // Temporary; replaced after JWT generation.
				status: TokenStatus.ACTIVE,
				expiresAt,
				metadata: dto.metadata ?? null,
				lastUsedAt: new Date()
			});

			this.logger.debug(`Token record created with id=${tokenRecord.id} for user=${dto.userId}`);

			// Step 2: Generate the signed JWT, binding it to the persisted record.
			const payload = {
				...dto.metadata,
				userId: dto.userId,
				tokenType: dto.tokenType,
				tokenId: tokenRecord.id
			};

			const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : undefined;
			// Clamp to at least 1 second so JWT libraries never receive 0 or a
			// negative value.
			const expiresInSeconds = expiresInMs ? Math.max(1, Math.ceil(expiresInMs / 1000)) : undefined;

			let jwt: string;
			try {
				jwt = await jwtService.sign(payload, expiresInSeconds);
			} catch (error: any) {
				this.logger.error(`JWT signing failed for user=${dto.userId}: ${error?.message}`, error?.stack);
				throw new InternalServerErrorException('Failed to sign token');
			}

			// Step 3: Replace the placeholder hash with the real hash derived from
			// the signed JWT so validation look-ups work correctly.
			const tokenHash = this.tokenHasher.hashToken(jwt);
			tokenRecord.tokenHash = tokenHash;

			try {
				await manager.save(tokenRecord);
			} catch (error: any) {
				this.logger.error(
					`Failed to persist token hash for id=${tokenRecord.id}: ${error?.message}`,
					error?.stack
				);
				throw new InternalServerErrorException('Failed to persist token');
			}

			this.logger.log(`Token issued — id=${tokenRecord.id} user=${dto.userId} type=${dto.tokenType}`);

			return {
				token: jwt,
				tokenId: tokenRecord.id,
				expiresAt: tokenRecord.expiresAt,
				createdAt: tokenRecord.createdAt
			};
		});
	}
}
