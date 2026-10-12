import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber, Token } from '@gauzy/core';
import { IssuedPlatformToken, PLATFORM_REFRESH_TOKEN_TYPE, ZitadelTokenBinding } from './zitadel-token-binding';

/**
 * Tells the Ever ID session service about every fresh refresh token the platform issues, so a session
 * opened through Ever ID is bound to the exact token of its sign-in.
 *
 * The work is handed off after the insert returns and runs on the session service's own connection:
 * it never slows down, and never fails, the platform's token write.
 */
@EventSubscriber()
export class ZitadelTokenSubscriber extends BaseEntityEventSubscriber<Token> {
	listenTo() {
		return Token;
	}

	async afterEntityCreate(entity: Token): Promise<void> {
		const binder = ZitadelTokenBinding.current();
		if (!binder || entity?.tokenType !== PLATFORM_REFRESH_TOKEN_TYPE || entity.rotatedFromTokenId) {
			return;
		}
		const issued: IssuedPlatformToken = {
			id: entity.id,
			userId: entity.userId,
			tokenType: entity.tokenType,
			rotatedFromTokenId: entity.rotatedFromTokenId
		};
		setImmediate(() => {
			binder.bindRefreshToken(issued).catch(() => undefined);
		});
	}
}
