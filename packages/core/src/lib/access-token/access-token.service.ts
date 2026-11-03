import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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
}
