import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ITokenHasher } from '../../interfaces/jwt-service.interface';
import { ITokenReadRepository, ITokenWriteRepository } from '../../interfaces/token-repository.interface';
import { IValidatedToken, TokenStatus } from '../../interfaces/token.interface';
import { TokenReadRepositoryToken, TokenWriteRepositoryToken } from '../../shared';
import { TokenHasher } from '../../shared/token-hasher';
import { TokenConfigRegistry } from '../../token-config.registry';
import { ValidateTokenQuery } from '../validate-token.query';

@QueryHandler(ValidateTokenQuery)
export class ValidateTokenHandler implements IQueryHandler<ValidateTokenQuery, IValidatedToken> {
	constructor(
		private readonly configRegistry: TokenConfigRegistry,
		@Inject(TokenReadRepositoryToken)
		private readonly tokenReadRepository: ITokenReadRepository,
		@Inject(TokenWriteRepositoryToken)
		private readonly tokenWriteRepository: ITokenWriteRepository,
		@Inject(TokenHasher)
		private readonly tokenHasher: ITokenHasher
	) {}

	async execute(query: ValidateTokenQuery): Promise<IValidatedToken> {
		const { dto } = query;
		const rawToken = dto.rawToken;
		const jwtService = this.configRegistry.getJwtService(dto.tokenType);

		try {
			// Verify JWT signature and expiration
			const payload = await jwtService.verify(rawToken);

			// Check token type matches
			if (payload.tokenType !== dto.tokenType) {
				return {
					isValid: false,
					reason: 'Token type mismatch'
				};
			}

			// Hash the token for database lookup
			const tokenHash = this.tokenHasher.hashToken(rawToken);

			// Find token in database
			const tokenRecord = await this.tokenReadRepository.findByHash(tokenHash);

			if (!tokenRecord) {
				return {
					isValid: false,
					reason: 'Token not found in database'
				};
			}

			// Check if token is active (status only; expiration handled below)
			if (!tokenRecord.isActivated()) {
				return {
					isValid: false,
					reason: `Token is ${tokenRecord.status.toLowerCase()}`
				};
			}

			// Check expiration (database level)
			if (tokenRecord.isExpired()) {
				// Mark as expired
				await this.tokenWriteRepository.updateStatus(tokenRecord.id, TokenStatus.EXPIRED, tokenRecord.version);

				return {
					isValid: false,
					reason: 'Token has expired'
				};
			}

			// Check inactivity if configured
			if (dto.checkInactivity) {
				const config = this.configRegistry.getConfig(dto.tokenType);
				if (config.threshold && tokenRecord.isInactive(config.threshold)) {
					// Revoke due to inactivity
					await this.tokenWriteRepository.updateStatus(
						tokenRecord.id,
						TokenStatus.REVOKED,
						tokenRecord.version,
						{
							revokedReason: 'Inactivity timeout'
						}
					);

					return {
						isValid: false,
						reason: 'Token revoked due to inactivity'
					};
				}
			}

			// Update last used timestamp (fire and forget to not slow down validation)
			this.tokenWriteRepository.updateLastUsed(tokenRecord.id).catch((error) => {
				// Log error but don't fail validation
				console.error(`Failed to update last used for token ${tokenRecord.id}`, error);
			});

			return {
				isValid: true,
				token: payload
			};
		} catch (error: any) {
			return {
				isValid: false,
				reason: error.message || 'Invalid token'
			};
		}
	}
}
