import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
	CreateTokenCommand,
	MarkSessionSignedOutCommand,
	RevokeAllUserTokensCommand,
	RevokeTokenByIdCommand,
	RevokeTokenCommand,
	RotateTokenCommand,
	TouchTokenCommand
} from './commands';
import { IGeneratedToken, IToken, ITokenQueryResult, IValidatedToken, TokenStatus } from './interfaces';
import {
	GetActiveTokensQuery,
	GetTokenByIdQuery,
	GetTokensQuery,
	IsSessionSignedOutQuery,
	ValidateTokenQuery
} from './queries';
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

	/**
	 * The stored token with this id, when it is of this service's type; null otherwise.
	 */
	async getTokenById(tokenId: string): Promise<IToken | null> {
		try {
			const token: IToken = await this.queryBus.execute(new GetTokenByIdQuery(tokenId));
			if (token.tokenType !== this.tokenType) {
				return null;
			}
			return token;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Revoke one of a user's tokens of this type by its id (tokenType automatically set).
	 *
	 * @returns Whether this call revoked it.
	 */
	async revokeTokenById(dto: {
		tokenId: string;
		userId: string;
		revokedById?: string;
		reason?: string;
		reviseRevoked?: boolean;
	}): Promise<boolean> {
		return this.commandBus.execute(new RevokeTokenByIdCommand({ ...dto, tokenType: this.tokenType }));
	}

	/**
	 * Record that the user signed a session out, until `expiresAt` (see `shared/session-sign-out-marker.ts`).
	 */
	async markSessionSignedOut(userId: string, sessionId: string, expiresAt: Date, reason: string): Promise<void> {
		return this.commandBus.execute(new MarkSessionSignedOutCommand(userId, sessionId, expiresAt, reason));
	}

	/**
	 * Whether the user signed the session out.
	 */
	async isSessionSignedOut(userId: string, sessionId: string): Promise<boolean> {
		return this.queryBus.execute(new IsSessionSignedOutQuery(userId, sessionId));
	}

	/**
	 * A user's tokens of this type created since `since` and revoked, read page by page.
	 *
	 * The pages go newest first, each one up to the oldest token the last one returned, and never by offset: the token
	 * read pages with `paginate`, which takes an offset as a page number on both ORMs, so an offset of 100 passed over
	 * 9,900 rows and no token past the first hundred was read. The token the next page starts from comes again, once.
	 */
	async getRevokedTokensSince(userId: string, since: Date): Promise<IToken[]> {
		const pageSize = 100;
		const tokens = new Map<string, IToken>();
		const filters = { userId, tokenType: this.tokenType, status: TokenStatus.REVOKED, createdAfter: since };
		let createdBefore: Date | undefined;
		for (;;) {
			const page: ITokenQueryResult = await this.queryBus.execute(
				new GetTokensQuery(createdBefore ? { ...filters, createdBefore } : filters, pageSize)
			);
			let added = 0;
			for (const token of page.items) {
				// A later page reads from `since` included, the first one after it: the same tokens either way
				if (!tokens.has(token.id) && new Date(token.createdAt).getTime() > since.getTime()) {
					tokens.set(token.id, token);
					added++;
				}
			}
			// A short page is the last one
			if (page.items.length < pageSize) {
				break;
			}
			// A full page of tokens already read: more of them share one instant than a page holds, so the next page
			// starts just before that instant rather than read it again
			const oldest = new Date(page.items[page.items.length - 1].createdAt);
			createdBefore = added === 0 ? new Date(oldest.getTime() - 1) : oldest;
		}
		return [...tokens.values()];
	}

	/**
	 * Record a use of a stored token: its last use becomes now.
	 */
	async touchToken(tokenId: string): Promise<void> {
		return this.commandBus.execute(new TouchTokenCommand(tokenId));
	}
}
