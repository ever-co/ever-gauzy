import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ScopedTokenService } from '../token/scoped-token.service';
import { ACCESS_TOKEN, IAccessTokenMetadata } from './type.token';

@Injectable()
export class AccessTokenService {
	constructor(
		@Inject(ACCESS_TOKEN)
		private readonly tokenService: ScopedTokenService
	) {}

	public async generate(userId: string, metadata?: IAccessTokenMetadata): Promise<string> {
		const created = await this.tokenService.createToken({
			metadata,
			userId
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
