import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
	buildConnectCallbackUrl,
	CONNECT_SESSION_KEY,
	CONNECT_SESSION_TTL_MS,
	provideAiProviderConnectCallback,
	readPendingConnect,
	takeConnectCallbackFromLocation
} from './ai-provider-connect-callback';

/**
 * The app routes with the hash location strategy, but OpenRouter returns the Connect code in the real query
 * string. The old callback (`…/#/pages/settings/ai`) came back as `https://app.gauzy.co/?code=…`, the router never
 * saw the code, and the flow silently stored nothing.
 */
describe('AI provider Connect callback', () => {
	const pending = { providerId: 'openrouter', verifier: 'v'.repeat(64), tenantId: 't', organizationId: null };

	const visit = (url: string) => window.history.replaceState(null, '', url);
	const current = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

	beforeEach(() => {
		sessionStorage.clear();
		visit('/');
	});

	it('hands the provider the document URL, without the hash route', () => {
		expect(buildConnectCallbackUrl({ origin: 'https://app.gauzy.co', pathname: '/' })).toBe(
			'https://app.gauzy.co/'
		);
	});

	describe('readPendingConnect', () => {
		it('returns the flow in flight', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify({ ...pending, startedAt: 1_000 }));
			expect(readPendingConnect(sessionStorage, 2_000)).toMatchObject({ providerId: 'openrouter' });
		});

		it('accepts a flow started before `startedAt` was recorded', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			expect(readPendingConnect()).toMatchObject({ providerId: 'openrouter' });
		});

		it('ignores a missing, malformed or expired flow', () => {
			expect(readPendingConnect()).toBeNull();
			sessionStorage.setItem(CONNECT_SESSION_KEY, '{not json');
			expect(readPendingConnect()).toBeNull();
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify({ providerId: 'openrouter' }));
			expect(readPendingConnect()).toBeNull();
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify({ ...pending, startedAt: 0 }));
			expect(readPendingConnect(sessionStorage, CONNECT_SESSION_TTL_MS + 1)).toBeNull();
			// A start time that is not a number cannot be aged, so it cannot be trusted either.
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify({ ...pending, startedAt: '1000' }));
			expect(readPendingConnect(sessionStorage, 2_000)).toBeNull();
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify({ ...pending, startedAt: null }));
			expect(readPendingConnect(sessionStorage, 2_000)).toBeNull();
		});
	});

	describe('takeConnectCallbackFromLocation', () => {
		it('moves the code from the root URL into the AI Providers route', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			visit('/?code=abc-123');

			expect(takeConnectCallbackFromLocation()).toBe('/pages/settings/ai?code=abc-123');
			expect(current()).toBe('/#/pages/settings/ai?code=abc-123');
		});

		it('replaces whatever hash route the provider kept, and keeps other query parameters', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			visit('/?ref=x&code=a%2Bb#/pages/dashboard');

			expect(takeConnectCallbackFromLocation()).toBe('/pages/settings/ai?code=a%2Bb');
			expect(current()).toBe('/?ref=x#/pages/settings/ai?code=a%2Bb');
		});

		it('leaves a `?code=` alone when no Connect flow is in flight', () => {
			visit('/?code=abc-123#/pages/dashboard');

			expect(takeConnectCallbackFromLocation()).toBeNull();
			expect(current()).toBe('/?code=abc-123#/pages/dashboard');
		});

		it('never throws when the browser blocks storage', () => {
			visit('/?code=abc-123');
			let storageRead = false;
			const blocked = {
				location: window.location,
				history: window.history,
				get sessionStorage(): Storage {
					storageRead = true;
					throw new DOMException('The operation is insecure.', 'SecurityError');
				}
			} as unknown as Window;

			expect(() => takeConnectCallbackFromLocation(blocked)).not.toThrow();
			expect(takeConnectCallbackFromLocation(blocked)).toBeNull();
			expect(storageRead).toBe(true);
			expect(current()).toBe('/?code=abc-123');
		});

		it('does nothing on a normal start', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			visit('/#/pages/settings/ai');

			expect(takeConnectCallbackFromLocation()).toBeNull();
			expect(current()).toBe('/#/pages/settings/ai');
		});
	});

	/** The initializer as the plugin installs it: an environment injector created during app start-up. */
	describe('provideAiProviderConnectCallback', () => {
		const boot = (navigated: boolean) => {
			const router = { navigated, navigateByUrl: jest.fn().mockResolvedValue(true) };
			TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
			createEnvironmentInjector([provideAiProviderConnectCallback()], TestBed.inject(EnvironmentInjector));
			return router;
		};

		it('before the initial navigation: rewrites the URL only, for that navigation to read', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			visit('/?code=abc-123');

			const router = boot(false);

			expect(current()).toBe('/#/pages/settings/ai?code=abc-123');
			expect(router.navigateByUrl).not.toHaveBeenCalled();
		});

		it('after the router already navigated: sends it to the AI Providers page', () => {
			sessionStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(pending));
			visit('/?code=abc-123#/pages/dashboard');

			const router = boot(true);

			expect(current()).toBe('/#/pages/settings/ai?code=abc-123');
			expect(router.navigateByUrl).toHaveBeenCalledWith('/pages/settings/ai?code=abc-123');
		});

		it('leaves a normal start alone', () => {
			visit('/#/pages/dashboard');

			const router = boot(true);

			expect(current()).toBe('/#/pages/dashboard');
			expect(router.navigateByUrl).not.toHaveBeenCalled();
		});
	});
});
