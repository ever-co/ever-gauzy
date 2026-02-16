import { Inject, Injectable } from '@nestjs/common';
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
}
