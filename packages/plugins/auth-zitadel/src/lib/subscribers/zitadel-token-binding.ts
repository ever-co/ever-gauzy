import { ID } from '@gauzy/contracts';

/** Token type of the platform's database-backed refresh tokens (the core refresh-token module's value). */
export const PLATFORM_REFRESH_TOKEN_TYPE = 'REFRESH_TOKEN_TYPE';

/** The parts of a newly issued platform token the session binding needs. */
export interface IssuedPlatformToken {
	id?: ID;
	userId?: ID;
	tokenType?: string;
	rotatedFromTokenId?: ID | null;
}

/** Receives every fresh refresh token the platform issues (the Ever ID session service). */
export interface ZitadelTokenBinder {
	bindRefreshToken(token: IssuedPlatformToken): Promise<void>;
}

let binder: ZitadelTokenBinder | null = null;

/**
 * The ORM creates entity subscribers itself, outside dependency injection, so the session service
 * registers itself here when the plugin starts (and unregisters when it stops).
 */
export const ZitadelTokenBinding = {
	register(next: ZitadelTokenBinder | null): void {
		binder = next;
	},
	current(): ZitadelTokenBinder | null {
		return binder;
	}
};
