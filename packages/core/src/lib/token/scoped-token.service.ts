import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateTokenCommand, RevokeAllUserTokensCommand, RevokeTokenCommand, RotateTokenCommand } from './commands';
import { IGeneratedToken, IToken, IValidatedToken } from './interfaces';
import { GetActiveTokensQuery, ValidateTokenQuery } from './queries';
import { ScopedTokenConfig } from './scoped-config.registry';

/**
 * Scoped Token Service
 * Automatically uses the token type from ScopedTokenConfig
 * User doesn't need to specify tokenType in every call
 */
@Injectable()
export class ScopedTokenService {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly scopedConfig: ScopedTokenConfig
	) {}

	/**
	 * Get the token type this service is scoped to
	 */
	get tokenType(): string {
		return this.scopedConfig.tokenType;
	}

	/**
	 * Create a new token (tokenType automatically set)
	 */
	async createToken(dto: {
		userId: string;
		metadata?: Record<string, any>;
		expiresAt?: Date;
	}): Promise<IGeneratedToken> {
		return this.commandBus.execute(
			new CreateTokenCommand({
				...dto,
				tokenType: this.tokenType
			})
		);
	}

	/**
	 * Rotate an existing token (tokenType automatically set)
	 */
	async rotateToken(dto: {
		rawOldToken: string;
		userId: string;
		metadata?: Record<string, any>;
	}): Promise<IGeneratedToken> {
		return this.commandBus.execute(
			new RotateTokenCommand({
				...dto,
				tokenType: this.tokenType
			})
		);
	}

	/**
	 * Revoke a token
	 */
	async revokeToken(dto: { rawToken: string; revokedById?: string; reason?: string }): Promise<void> {
		return this.commandBus.execute(new RevokeTokenCommand(dto));
	}

	/**
	 * Revoke all tokens for a user (tokenType automatically set)
	 */
	async revokeAllUserTokens(userId: string, revokedById?: string, reason?: string): Promise<number> {
		return this.commandBus.execute(new RevokeAllUserTokensCommand(userId, this.tokenType, revokedById, reason));
	}

	/**
	 * Validate a token (tokenType automatically set)
	 */
	async validateToken(dto: { rawToken: string; checkInactivity?: boolean }): Promise<IValidatedToken> {
		return this.queryBus.execute(
			new ValidateTokenQuery({
				...dto,
				tokenType: this.tokenType
			})
		);
	}

	/**
	 * Get active tokens for a user (tokenType automatically set)
	 */
	async getActiveTokens(userId: string): Promise<IToken[]> {
		return this.queryBus.execute(new GetActiveTokensQuery(userId, this.tokenType));
	}
}
