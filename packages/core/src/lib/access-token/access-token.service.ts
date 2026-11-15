import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IToken } from '../token/interfaces';
import { ScopedTokenService } from '../token/scoped-token.service';
import { ACCESS_TOKEN, IAccessTokenMetadata } from './type.token';

@Injectable()
export class AccessTokenService {
	constructor(
		@Inject(ACCESS_TOKEN)
		private readonly tokenService: ScopedTokenService
	) {}

	/**
	 * @param userId The user the token is for.
	 * @param metadata The claims.
	 * @param expiresAt When it expires, for a token that must not live as long as this type's configured expiry.
	 * @returns The signed token.
	 */
	public async generate(userId: string, metadata?: IAccessTokenMetadata, expiresAt?: Date): Promise<string> {
		const created = await this.tokenService.createToken({
			metadata,
			userId,
			...(expiresAt && { expiresAt })
		});
		return created.token;
	}

	public async verify(rawToken: string): Promise<IAccessTokenMetadata> {
		const { isValid, reason, token } = await this.tokenService.validateToken({
			rawToken,
			checkInactivity: true
		});

		if (!isValid) {
			throw new UnauthorizedException(reason ?? 'Invalid token');
		}

		return token;
	}

	public async revoke(rawToken: string, reason?: string, revokedById?: string): Promise<void> {
		await this.tokenService.revokeToken({
			revokedById,
			rawToken,
			reason
		});
	}

	/**
	 * @param tokenId The id an access token's payload carries (`tokenId`).
	 * @returns Its stored record, or null when the store has no access token with this id.
	 */
	public async findById(tokenId: string): Promise<IToken | null> {
		return this.tokenService.getTokenById(tokenId);
	}

	/**
	 * Records a use of the access token: its last use becomes now.
	 *
	 * @param tokenId The stored token's id.
	 */
	public async touch(tokenId: string): Promise<void> {
		await this.tokenService.touchToken(tokenId);
	}

	/**
	 * @param userId The user.
	 * @returns Their stored access tokens still active, newest first.
	 */
	public async findActive(userId: string): Promise<IToken[]> {
		return this.tokenService.getActiveTokens(userId);
	}

	/**
	 * Revokes one of a user's access tokens by its id.
	 *
	 * @returns Whether this call revoked it.
	 */
	public async revokeById(revocation: {
		tokenId: string;
		userId: string;
		revokedById?: string;
		reason?: string;
		reviseRevoked?: boolean;
	}): Promise<boolean> {
		return this.tokenService.revokeTokenById(revocation);
	}

	/**
	 * Records that the user signed the session out, until `expiresAt`.
	 */
	public async markSessionSignedOut(
		userId: string,
		sessionId: string,
		expiresAt: Date,
		reason: string
	): Promise<void> {
		await this.tokenService.markSessionSignedOut(userId, sessionId, expiresAt, reason);
	}

	/**
	 * @returns Whether the user signed the session out.
	 */
	public async isSessionSignedOut(userId: string, sessionId: string): Promise<boolean> {
		return this.tokenService.isSessionSignedOut(userId, sessionId);
	}

	/**
	 * @param userId The user.
	 * @param since The oldest creation date read.
	 * @returns Their access tokens created since then and revoked.
	 */
	public async findRevokedSince(userId: string, since: Date): Promise<IToken[]> {
		return this.tokenService.getRevokedTokensSince(userId, since);
	}
}
