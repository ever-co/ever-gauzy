import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { Router } from '@angular/router';

/** sessionStorage key holding the in-flight Connect (PKCE) state. */
export const CONNECT_SESSION_KEY = 'gauzy_ai_provider_connect';

/**
 * How long a started Connect flow may wait for the provider to redirect back. OpenRouter's code
 * itself expires after 10 minutes; past this, a `?code=` on the app's root URL belongs to something
 * else and is left alone.
 */
export const CONNECT_SESSION_TTL_MS = 30 * 60 * 1000;

/** The app route of the AI Providers settings page, which completes the Connect flow. */
export const AI_SETTINGS_URL = '/pages/settings/ai';

/** The Connect flow the settings page started, kept in sessionStorage across the provider round trip. */
export interface PendingConnect {
	providerId: string;
	verifier: string;
	tenantId?: string | null;
	organizationId?: string | null;
	/** Epoch milliseconds; absent on flows started before it was recorded. */
	startedAt?: number;
}

/**
 * Reads the in-flight Connect flow, or `null` when there is none, it is malformed, it is older
 * than {@link CONNECT_SESSION_TTL_MS}, or storage is unavailable.
 *
 * @param storage - Where the flow was stashed (default: sessionStorage, looked up inside the guard:
 *                  the getter itself throws a `SecurityError` when the browser blocks storage).
 * @param now - The current time, for tests.
 */
export function readPendingConnect(storage?: Storage, now: number = Date.now()): PendingConnect | null {
	try {
		const raw = (storage ?? sessionStorage).getItem(CONNECT_SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PendingConnect;
		if (!parsed?.providerId || !parsed?.verifier) return null;
		// No `startedAt` at all: a flow started before it was recorded. Anything else must be a time within the TTL.
		if (parsed.startedAt !== undefined) {
			if (typeof parsed.startedAt !== 'number' || now - parsed.startedAt > CONNECT_SESSION_TTL_MS) return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * The `callback_url` handed to the provider: the app's own document URL, WITHOUT the `#/…` route.
 *
 * The app routes with the hash location strategy, and OpenRouter returns the code in the real query
 * string (`https://app.gauzy.co/?code=…`, which is where its docs read it from: `location.search`),
 * never inside the hash. A callback of `…/#/pages/settings/ai` therefore came back as the root URL
 * with `?code=` before (or without) the hash, the router never saw the code, and the Connect flow
 * silently did nothing. The code is picked up from the query string by
 * {@link takeConnectCallbackFromLocation} instead.
 *
 * @param loc - The current location.
 */
export function buildConnectCallbackUrl(loc: Pick<Location, 'origin' | 'pathname'> = location): string {
	return `${loc.origin}${loc.pathname}`;
}

/**
 * When the provider redirected back to the app with `?code=…` in the query string and a Connect flow
 * is in flight, moves the code into the hash route of the AI Providers page
 * (`/#/pages/settings/ai?code=…`), where the settings page completes the exchange. Other query
 * parameters are kept; a `?code=` with no flow in flight is left untouched.
 *
 * Never throws: it runs at app start, where a failure (storage blocked by browser policy, a
 * refused `replaceState`) must not take the app down with it.
 *
 * @param win - The window whose location is rewritten.
 * @returns The app URL to navigate to, or `null` when there was nothing to take.
 */
export function takeConnectCallbackFromLocation(win: Window = window): string | null {
	try {
		const params = new URLSearchParams(win.location.search);
		const code = params.get('code');
		if (!code || !readPendingConnect(win.sessionStorage)) {
			return null;
		}
		params.delete('code');
		const search = params.toString();
		const target = `${AI_SETTINGS_URL}?code=${encodeURIComponent(code)}`;
		win.history.replaceState(
			win.history.state,
			'',
			`${win.location.pathname}${search ? `?${search}` : ''}#${target}`
		);
		return target;
	} catch {
		return null;
	}
}

/**
 * Completes the provider round trip of the Connect flow at app start: see
 * {@link takeConnectCallbackFromLocation}.
 *
 * Plugin providers are created in an app initializer, so the URL is normally rewritten before the
 * router's initial navigation, which then opens the AI Providers page from the new hash. Should the
 * router already have navigated, it is sent there explicitly.
 */
export function provideAiProviderConnectCallback(): EnvironmentProviders {
	return provideEnvironmentInitializer(() => {
		const target = takeConnectCallbackFromLocation();
		if (!target) {
			return;
		}
		const router = inject(Router);
		if (router.navigated) {
			void router.navigateByUrl(target);
		}
	});
}
