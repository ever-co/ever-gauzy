/**
 * Test-only harness: the plugin's controller and services on a real HTTP server, talking to a real
 * mock OpenID Provider, with in-memory stand-ins for the database and Gauzy's own services.
 * Excluded from the library build.
 */
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { OidcModule } from '@gauzy/auth';
import { EVER_REDIS_CLIENT, EventBus } from '@gauzy/core';
import { AuthZitadelController } from '../auth-zitadel.controller';
import { AuthZitadelSettings, parseZitadelSettings } from '../auth-zitadel.config';
import { AUTH_ZITADEL_SETTINGS } from '../auth-zitadel.tokens';
import { ZitadelConfiguredGuard } from '../guards/zitadel-configured.guard';
import { ZitadelHandoffThrottleGuard } from '../guards/zitadel-handoff-throttle.guard';
import { ZitadelRetryAfterInterceptor } from '../http/zitadel-retry';
import { EVER_CONNECT_CONFIG, EverConnectConfigPort } from '../ports/ever-connect-config.port';
import { ITermsAcceptanceDocument } from '@gauzy/contracts';
import { GAUZY_AUTH } from '../ports/gauzy-auth.port';
import { TERMS_DOCUMENTS, TermsDocumentsPort } from '../ports/terms-documents.port';
import { ZitadelAccountService } from '../services/zitadel-account.service';
import { ZitadelBackchannelService } from '../services/zitadel-backchannel.service';
import { ZitadelClaimsService } from '../services/zitadel-claims.service';
import { ZitadelConfigService } from '../services/zitadel-config.service';
import { ZitadelEventsService } from '../services/zitadel-events.service';
import { ZitadelFlowService } from '../services/zitadel-flow.service';
import { ZitadelLinkService } from '../services/zitadel-link.service';
import { ZitadelSessionService } from '../services/zitadel-session.service';
import { ZitadelSigninService } from '../services/zitadel-signin.service';
import { ZitadelSignupService } from '../services/zitadel-signup.service';
import { ZitadelStoreService } from '../services/zitadel-store.service';
import { ZitadelSubscriptionGateService } from '../services/zitadel-subscription-gate.service';
import { ZitadelTokenSigninService } from '../services/zitadel-token-signin.service';
import { ZitadelWorkspaceService } from '../services/zitadel-workspace.service';
import { FakeGauzyAuth, FakeSubscriptionGate, InMemoryAccounts, InMemoryCache, InMemorySessions } from './in-memory-accounts';
import { MockOidcIssuer } from './mock-oidc-issuer';

export const TEST_CLIENT_ID = 'gauzy-web-test';
export const TEST_CLIENT_BASE_URL = 'http://client.example.test';

export interface ZitadelTestApp {
	app: INestApplication;
	baseUrl: string;
	issuer: MockOidcIssuer;
	settings: AuthZitadelSettings;
	accounts: InMemoryAccounts;
	gauzyAuth: FakeGauzyAuth;
	gate: FakeSubscriptionGate;
	sessions: InMemorySessions;
	cache: InMemoryCache;
	terms: FakeTermsDocuments;
	/** The plugin's one-time store (to hold a key as a concurrent attempt would). */
	store: ZitadelStoreService;
	published: unknown[];
	close(): Promise<void>;
}

/** Gauzy's required legal documents, settable per test (none by default). */
export class FakeTermsDocuments implements TermsDocumentsPort {
	required: ITermsAcceptanceDocument[] = [];
	/** The locale of every request. */
	readonly locales: Array<string | undefined> = [];

	getRequiredDocuments(locale?: string): ITermsAcceptanceDocument[] {
		this.locales.push(locale);
		return this.required;
	}
}

export interface ZitadelTestAppOptions {
	/** Extra environment for the plugin settings (merged over the defaults). */
	env?: Record<string, string>;
	/** Replace the issuer list (for example with an Ever host). */
	issuers?: (issuer: MockOidcIssuer) => string;
	/** Provide the optional connected-instance port. */
	everConnect?: EverConnectConfigPort;
}

async function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}

/** Starts the mock issuer and the plugin on a local port. */
export async function createZitadelTestApp(options: ZitadelTestAppOptions = {}): Promise<ZitadelTestApp> {
	const clientSecret = randomBytes(16).toString('hex');
	const issuer = new MockOidcIssuer(TEST_CLIENT_ID, clientSecret);
	await issuer.start();
	try {
		// A port found free can be taken by another test worker before the app binds it: try again.
		for (let attempt = 1; ; attempt++) {
			try {
				return await startApp(issuer, clientSecret, await freePort(), options);
			} catch (error) {
				if ((error as { code?: string })?.code !== 'EADDRINUSE' || attempt >= 5) {
					throw error;
				}
			}
		}
	} catch (error) {
		await issuer.stop();
		throw error;
	}
}

async function startApp(
	issuer: MockOidcIssuer,
	clientSecret: string,
	port: number,
	options: ZitadelTestAppOptions
): Promise<ZitadelTestApp> {
	const baseUrl = `http://127.0.0.1:${port}`;
	const settings = parseZitadelSettings({
		ZITADEL_ISSUERS: options.issuers ? options.issuers(issuer) : issuer.issuer,
		ZITADEL_CLIENT_ID: TEST_CLIENT_ID,
		ZITADEL_CLIENT_SECRET: clientSecret,
		ZITADEL_ALLOWED_AUDIENCES: 'teams-web',
		API_BASE_URL: baseUrl,
		CLIENT_BASE_URL: TEST_CLIENT_BASE_URL,
		...options.env
	});

	const accounts = new InMemoryAccounts();
	const gauzyAuth = new FakeGauzyAuth(accounts);
	const gate = new FakeSubscriptionGate();
	const sessions = new InMemorySessions();
	const cache = new InMemoryCache();
	const terms = new FakeTermsDocuments();
	const published: unknown[] = [];

	const moduleRef = await Test.createTestingModule({
		imports: [OidcModule.forRoot({ transactionSecret: randomBytes(32).toString('hex') })],
		controllers: [AuthZitadelController],
		providers: [
			{ provide: AUTH_ZITADEL_SETTINGS, useValue: settings },
			{ provide: CACHE_MANAGER, useValue: cache },
			{ provide: EVER_REDIS_CLIENT, useValue: null },
			{ provide: ZitadelAccountService, useValue: accounts },
			{ provide: ZitadelSessionService, useValue: sessions },
			{ provide: ZitadelSubscriptionGateService, useValue: gate },
			{ provide: GAUZY_AUTH, useValue: gauzyAuth },
			{ provide: TERMS_DOCUMENTS, useValue: terms },
			{ provide: EventBus, useValue: { publish: async (event: unknown) => published.push(event) } },
			...(options.everConnect ? [{ provide: EVER_CONNECT_CONFIG, useValue: options.everConnect }] : []),
			ZitadelConfigService,
			ZitadelStoreService,
			ZitadelClaimsService,
			ZitadelWorkspaceService,
			ZitadelEventsService,
			ZitadelSignupService,
			ZitadelSigninService,
			ZitadelLinkService,
			ZitadelFlowService,
			ZitadelTokenSigninService,
			ZitadelBackchannelService,
			ZitadelConfiguredGuard,
			ZitadelHandoffThrottleGuard,
			ZitadelRetryAfterInterceptor
		]
	}).compile();

	const app = moduleRef.createNestApplication({ logger: false });
	app.setGlobalPrefix('api');
	try {
		await app.listen(port, '127.0.0.1');
	} catch (error) {
		await app.close().catch(() => undefined);
		throw error;
	}

	return {
		app,
		baseUrl,
		issuer,
		settings,
		accounts,
		gauzyAuth,
		gate,
		sessions,
		cache,
		terms,
		store: moduleRef.get(ZitadelStoreService),
		published,
		async close() {
			await app.close();
			await issuer.stop();
		}
	};
}

/** A minimal browser: follows nothing on its own, keeps cookies per origin. */
export class TestBrowser {
	private readonly cookies = new Map<string, string>();
	/** Every `Location` header the browser received. */
	readonly locations: string[] = [];

	async get(url: string, headers: Record<string, string> = {}): Promise<Response> {
		return this.request(url, { method: 'GET', headers });
	}

	async post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
		return this.request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...headers },
			body: JSON.stringify(body)
		});
	}

	async postForm(url: string, form: Record<string, string>): Promise<Response> {
		return this.request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(form).toString()
		});
	}

	async delete(url: string): Promise<Response> {
		return this.request(url, { method: 'DELETE' });
	}

	/**
	 * Follows redirects until the next hop leaves the given origins (the web app), returning the last
	 * `Location`.
	 */
	async follow(url: string, stopOrigin: string): Promise<string> {
		let next = url;
		for (let hop = 0; hop < 10; hop++) {
			const response = await this.get(next);
			const location = response.headers.get('location');
			if (!location) {
				throw new Error(`No redirect from ${next} (${response.status})`);
			}
			if (location.startsWith(stopOrigin)) {
				return location;
			}
			next = location;
		}
		throw new Error('Too many redirects');
	}

	private async request(url: string, init: RequestInit): Promise<Response> {
		const origin = new URL(url).origin;
		const headers = new Headers(init.headers);
		const cookie = this.cookies.get(origin);
		if (cookie) {
			headers.set('cookie', cookie);
		}
		const response = await fetch(url, { ...init, headers, redirect: 'manual' });
		const setCookies = response.headers.getSetCookie?.() ?? [];
		for (const setCookie of setCookies) {
			const [name, value] = splitPair(setCookie.split(';')[0]);
			const jar = new Map(
				(this.cookies.get(origin) ?? '')
					.split('; ')
					.filter(Boolean)
					.map((entry) => splitPair(entry))
			);
			if (!value || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie)) {
				jar.delete(name);
			} else {
				jar.set(name, value);
			}
			this.cookies.set(origin, [...jar].map(([key, val]) => `${key}=${val}`).join('; '));
		}
		const location = response.headers.get('location');
		if (location) {
			this.locations.push(location);
		}
		return response;
	}
}

/** Splits `name=value` at the first `=` (a value may contain `=` itself). */
function splitPair(pair: string): [string, string] {
	const separator = pair.indexOf('=');
	return separator < 0 ? [pair.trim(), ''] : [pair.slice(0, separator).trim(), pair.slice(separator + 1)];
}

/** Reads the `handoff` (or another) parameter from a web app hash-route URL. */
export function hashParam(location: string, name: string): string | null {
	const hash = new URL(location).hash;
	const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
	return new URLSearchParams(query).get(name);
}
