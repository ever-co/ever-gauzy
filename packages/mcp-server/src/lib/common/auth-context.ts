import { AsyncLocalStorage } from 'node:async_hooks';

interface IAuthContext {
	authKey?: string;
	/** Whether this caller may run as the GAUZY_AUTO_LOGIN account when it has no login of its own */
	sharesAutoLogin?: boolean;
}

const authContext = new AsyncLocalStorage<IAuthContext>();

export interface IRunWithAuthKeyOptions {
	/**
	 * Whether the caller may fall back to the GAUZY_AUTO_LOGIN account (see {@link isLocalCaller}).
	 * Left out, the enclosing call's answer is kept, and outside any call the fallback is allowed, as stdio needs.
	 */
	sharesAutoLogin?: boolean;
}

/**
 * Run `fn` on behalf of one HTTP or WebSocket caller (a session id or an OAuth subject).
 * AuthManager reads and writes that caller's Gauzy login instead of the process-wide one.
 * With no key the process-wide login is used, which is what stdio relies on.
 */
export function runWithAuthKey<T>(authKey: string | undefined, fn: () => T, options: IRunWithAuthKeyOptions = {}): T {
	const sharesAutoLogin = options.sharesAutoLogin ?? authContext.getStore()?.sharesAutoLogin;
	return authContext.run({ authKey, sharesAutoLogin }, fn);
}

/**
 * Auth key of the current caller, if any
 */
export function getAuthKey(): string | undefined {
	return authContext.getStore()?.authKey;
}

/**
 * Whether the current caller may run as the GAUZY_AUTO_LOGIN account when it has no login of its own
 */
export function mayShareAutoLogin(): boolean {
	return authContext.getStore()?.sharesAutoLogin ?? true;
}
