import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IToken, IValidatedToken } from '../token/interfaces';
import { ScopedTokenService } from '../token/scoped-token.service';
import { CURRENT_USER_PROVIDER, ICurrentUserProvider } from './current-user.provider';
import { IRefreshTokenMetadata, REFRESH_TOKEN } from './type.token';

@Injectable()
export class RefreshTokenService {
	constructor(
		@Inject(REFRESH_TOKEN)
		private readonly tokenService: ScopedTokenService,
		@Inject(CURRENT_USER_PROVIDER)
		private readonly currentUserProvider: ICurrentUserProvider
	) {}

	public async verify(rawToken: string): Promise<IValidatedToken> {
		return this.tokenService.validateToken({
			rawToken,
			checkInactivity: true
		});
	}

	public async generate(userId: string, metadata?: IRefreshTokenMetadata): Promise<string> {
		const created = await this.tokenService.createToken({
			metadata,
			userId
		});

		return created.token;
	}

	public async rotate(rawOldToken: string, metadata?: IRefreshTokenMetadata): Promise<string> {
		const userId = this.getUserId();

		const { isValid, reason } = await this.verify(rawOldToken);

		if (!isValid) {
			throw new UnauthorizedException(reason ?? 'Invalid refresh token');
		}

		const rotated = await this.tokenService.rotateToken({
			rawOldToken,
			userId,
			metadata
		});

		return rotated.token;
	}

	public async revoke(rawToken: string, reason?: string, revokedById = this.getUserId()): Promise<void> {
		await this.tokenService.revokeToken({
			revokedById,
			rawToken,
			reason
		});
	}

	public getUserId(): string {
		return this.currentUserProvider.getCurrentUserId();
	}

	/**
	 * @param userId The user.
	 * @returns Their stored refresh tokens still active (the latest of each rotation chain), newest first.
	 */
	public async findActive(userId: string): Promise<IToken[]> {
		return this.tokenService.getActiveTokens(userId);
	}

	/**
	 * @returns Whether the user signed the session out.
	 */
	public async isSessionSignedOut(userId: string, sessionId: string): Promise<boolean> {
		return this.tokenService.isSessionSignedOut(userId, sessionId);
	}

	/**
	 * Revokes one of a user's refresh tokens by its id.
	 *
	 * @returns Whether this call revoked it.
	 */
	public async revokeById(revocation: {
		tokenId: string;
		userId: string;
		revokedById?: string;
		reason?: string;
	}): Promise<boolean> {
		return this.tokenService.revokeTokenById(revocation);
	}
}
