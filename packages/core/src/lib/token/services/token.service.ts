import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateTokenCommand, RevokeAllUserTokensCommand, RevokeTokenCommand, RotateTokenCommand } from '../commands';
import {
	ICreateTokenDto,
	IGeneratedToken,
	IRevokeTokenDto,
	IRotateTokenDto,
	IToken,
	ITokenFilters,
	ITokenQueryResult,
	IValidateTokenDto,
	IValidatedToken
} from '../interfaces/token.interface';
import {
	GetActiveTokensQuery,
	GetTokenAuditTrailQuery,
	GetTokenByIdQuery,
	GetTokensQuery,
	ValidateTokenQuery
} from '../queries';

/**
 * Token Service - Facade for CQRS operations
 * Implements Facade Pattern - provides simplified interface to complex CQRS subsystem
 */
@Injectable()
export class TokenService {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Create a new token
	 */
	public async createToken(dto: ICreateTokenDto): Promise<IGeneratedToken> {
		return this.commandBus.execute(new CreateTokenCommand(dto));
	}

	/**
	 * Rotate an existing token
	 */
	public async rotateToken(dto: IRotateTokenDto): Promise<IGeneratedToken> {
		return this.commandBus.execute(new RotateTokenCommand(dto));
	}

	/**
	 * Revoke a token
	 */
	public async revokeToken(dto: IRevokeTokenDto): Promise<void> {
		return this.commandBus.execute(new RevokeTokenCommand(dto));
	}

	/**
	 * Revoke all tokens for a user by type
	 */
	public async revokeAllUserTokens(
		userId: string,
		tokenType: string,
		revokedBy?: string,
		reason?: string
	): Promise<number> {
		return this.commandBus.execute(new RevokeAllUserTokensCommand(userId, tokenType, revokedBy, reason));
	}

	/**
	 * Validate a token
	 */
	public async validateToken(dto: IValidateTokenDto): Promise<IValidatedToken> {
		return this.queryBus.execute(new ValidateTokenQuery(dto));
	}

	/**
	 * Get token by ID
	 */
	public async getTokenById(tokenId: string): Promise<IToken> {
		return this.queryBus.execute(new GetTokenByIdQuery(tokenId));
	}

	/**
	 * Get active tokens for a user by type
	 */
	public async getActiveTokens(userId: string, tokenType: string): Promise<IToken[]> {
		return this.queryBus.execute(new GetActiveTokensQuery(userId, tokenType));
	}

	/**
	 * Query tokens with filters
	 */
	public async queryTokens(filters: ITokenFilters, limit?: number, offset?: number): Promise<ITokenQueryResult> {
		return this.queryBus.execute(new GetTokensQuery(filters, limit, offset));
	}

	/**
	 * Get audit trail for a token (rotation history)
	 */
	public async getTokenAuditTrail(tokenId: string): Promise<IToken[]> {
		return this.queryBus.execute(new GetTokenAuditTrailQuery(tokenId));
	}
}
