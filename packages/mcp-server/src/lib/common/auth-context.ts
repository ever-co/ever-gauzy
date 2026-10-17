import { AsyncLocalStorage } from 'node:async_hooks';

interface IAuthContext {
	authKey?: string;
}

const authContext = new AsyncLocalStorage<IAuthContext>();

/**
 * Run `fn` on behalf of one HTTP or WebSocket caller (a session id or an OAuth subject).
 * AuthManager reads and writes that caller's Gauzy login instead of the process-wide one.
 * With no key the process-wide login is used, which is what stdio relies on.
 */
export function runWithAuthKey<T>(authKey: string | undefined, fn: () => T): T {
	return authContext.run({ authKey }, fn);
}

/**
 * Auth key of the current caller, if any
 */
export function getAuthKey(): string | undefined {
	return authContext.getStore()?.authKey;
}
