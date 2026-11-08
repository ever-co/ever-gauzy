import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { isAppLauncherEnabled, parseZitadelSettings, signinScopes } from '../auth-zitadel.config';
import { AUTH_ZITADEL_MIGRATIONS } from '../auth-zitadel.plugin';
import { AddZitadelSessionRefreshToken1791000006450 } from '../database/migrations/1791000006450-AddZitadelSessionRefreshToken';
import { InMemoryCache } from '../fixtures/in-memory-accounts';
import { TestTokenVault } from '../fixtures/test-token-vault';
import { TEST_CLIENT_BASE_URL, TestBrowser, ZitadelTestApp, createZitadelTestApp } from '../fixtures/zitadel-test-app';
import { EverIdExchangeError } from '../ports/ever-id-session-tokens.port';
import { ZitadelRefreshTokenService } from '../services/zitadel-refresh-token.service';
import { ZitadelSessionService } from '../services/zitadel-session.service';
import { ZitadelStoreService } from '../services/zitadel-store.service';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const LAUNCHER_ON = { EVER_APP_LAUNCHER_ENABLED: 'true' };
const PLATFORM = { audience: 'platform-project-id', scope: 'apps:read' };

/** A promise the test resolves itself. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

/** Every line the plugin logs during a test (Nest's logger and the console), to look for token values in. */
function captureLogs(): { lines: string[]; restore: () => void } {
	const lines: string[] = [];
	const record = (...args: unknown[]) => {
		lines.push(args.map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack}` : String(arg))).join(' '));
	};
	const spies = [
		...(['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
			jest.spyOn(Logger.prototype, level).mockImplementation(record as never)
		),
		...(['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
			jest.spyOn(Logger, level).mockImplementation(record as never)
		),
		...(['log', 'warn', 'error', 'info', 'debug'] as const).map((level) =>
			jest.spyOn(console, level).mockImplementation(record as never)
		)
	];
	return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

describe('App Launcher switch', () => {
	const base = {
		ZITADEL_ISSUERS: 'https://idp.example.test',
		ZITADEL_CLIENT_ID: 'web',
		ZITADEL_CLIENT_SECRET: 'secret'
	};

	it('is on only for EVER_APP_LAUNCHER_ENABLED=true, exactly, and reports other values without repeating them', () => {
		expect(isAppLauncherEnabled({})).toBe(false);
		expect(isAppLauncherEnabled({ EVER_APP_LAUNCHER_ENABLED: 'false' })).toBe(false);
		for (const value of ['TRUE', '1', 'yes', ' true', 'on']) {
			const warnings: string[] = [];
			expect(isAppLauncherEnabled({ EVER_APP_LAUNCHER_ENABLED: value }, (m) => warnings.push(m))).toBe(false);
			expect(warnings).toEqual(['EVER_APP_LAUNCHER_ENABLED must be "true" or "false"; using false.']);
		}
		expect(isAppLauncherEnabled({ EVER_APP_LAUNCHER_ENABLED: 'true' })).toBe(true);
	});

	it('leaves the configured scopes unchanged either way; only a sign-in that keeps a token adds offline_access', () => {
		const off = parseZitadelSettings(base);
		const on = parseZitadelSettings({ ...base, ...LAUNCHER_ON });
		expect(off.launcherEnabled).toBe(false);
		expect(on.launcherEnabled).toBe(true);
		expect(on.scopes).toEqual(off.scopes);
		expect(off.scopes).not.toContain('offline_access');

		expect(signinScopes(off.scopes, false)).toBe(off.scopes);
		expect(signinScopes(on.scopes, true)).toEqual([...on.scopes, 'offline_access']);
		expect(signinScopes(['openid', 'offline_access'], true)).toEqual(['openid', 'offline_access']);
	});

	it('registers the migration that adds the column for the kept token', () => {
		expect(AUTH_ZITADEL_MIGRATIONS).toEqual([AddZitadelSessionRefreshToken1791000006450]);
	});
});

describe('Ever ID refresh token kept for the App Launcher (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	afterEach(async () => {
		await t?.close();
	});

	/** A linked person signs in through the browser; returns the Gauzy user id and the Ever ID session id. */
	async function linkedSignIn(subject: string): Promise<{ userId: string; sid: string; authorize: URLSearchParams }> {
		const user = t.accounts.addUser({ email: `${subject}@example.test`, tenantName: 'One' });
		await t.accounts.link([user], { issuer: t.issuer.issuer, subject }, 'explicit');
		t.issuer.nextClaims = { sub: subject };
		const landing = await browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);
		expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?handoff=`);
		return { userId: user.id, sid: `sid-${subject}`, authorize: t.issuer.lastAuthorizeQuery };
	}

	describe('switched off (the default)', () => {
		beforeEach(async () => {
			t = await createZitadelTestApp();
			browser = new TestBrowser();
		});

		it('asks for no refresh token, keeps nothing and gives no token', async () => {
			const { userId, sid, authorize } = await linkedSignIn('person-off');

			expect(authorize.get('scope').split(' ')).not.toContain('offline_access');
			expect(t.issuer.refreshTokens.size).toBe(0);
			expect(t.sessions.recorded).toEqual([
				expect.objectContaining({ sid, userId, everRefreshTokenEncrypted: null })
			]);
			expect(t.refreshTokens.keeping).toBe(false);
			expect(await t.refreshTokens.sessionOf(userId)).toBeNull();
			expect(await t.refreshTokens.exchange(sid, PLATFORM)).toBeNull();
			expect(t.issuer.tokenRequests.map((request) => request.grantType)).toEqual(['authorization_code']);
		});
	});

	describe('switched on', () => {
		let logs: ReturnType<typeof captureLogs>;

		beforeEach(async () => {
			logs = captureLogs();
			t = await createZitadelTestApp({ env: LAUNCHER_ON });
			browser = new TestBrowser();
		});

		afterEach(() => {
			const secrets = [
				...t.issuer.refreshTokens.keys(),
				...t.issuer.accessTokens.keys(),
				'mock-rt-',
				'mock-at-',
				'mock-xt-'
			];
			const kept = t.sessions.recorded.map((row) => row.everRefreshTokenEncrypted).filter(Boolean) as string[];
			for (const line of logs.lines) {
				for (const secret of [...secrets, ...kept]) {
					expect(line).not.toContain(secret);
				}
			}
			logs.restore();
		});

		it('asks for offline_access and keeps the refresh token encrypted, never in clear', async () => {
			const { userId, sid, authorize } = await linkedSignIn('person-on');

			expect(authorize.get('scope').split(' ')).toContain('offline_access');
			const [issued] = [...t.issuer.refreshTokens.keys()];
			expect(issued).toMatch(/^mock-rt-/);
			const [row] = t.sessions.recorded;
			expect(row).toEqual(expect.objectContaining({ sid, userId }));
			// Sealed by the encryption the connection plugin provides (here its test stand-in), never in clear.
			expect(row.everRefreshTokenEncrypted).toMatch(/^vault:v1:[\w-]+:[\w-]+:[\w-]+$/);
			expect(row.everRefreshTokenEncrypted).not.toContain(issued);
			expect(
				Buffer.from(row.everRefreshTokenEncrypted.split(':')[4], 'base64url').toString('latin1')
			).not.toContain(issued);
			expect(JSON.parse(t.vault.open(row.everRefreshTokenEncrypted))).toEqual({
				v: 1,
				issuer: t.issuer.issuer,
				refreshToken: issued
			});
			expect(await t.refreshTokens.sessionOf(userId)).toBe(sid);
		});

		it('refreshes once (rotating the kept token), then exchanges for apps:read on each call', async () => {
			const { sid } = await linkedSignIn('person-exchange');
			const before = t.sessions.recorded[0].everRefreshTokenEncrypted;
			const [firstRefreshToken] = [...t.issuer.refreshTokens.keys()];

			const now = Math.floor(Date.now() / 1000);
			const delegated = await t.refreshTokens.exchange(sid, PLATFORM);
			expect(delegated.token).toMatch(/^mock-xt-/);
			expect(delegated.expiresAt).toBeGreaterThanOrEqual(now + 3600 - 60 - 2);
			expect(delegated.expiresAt).toBeLessThanOrEqual(now + 3600 - 60 + 2);

			// The refresh token was used once and rotated; the stored one is the new one, still encrypted.
			expect(t.issuer.refreshTokens.has(firstRefreshToken)).toBe(false);
			const after = t.sessions.recorded[0].everRefreshTokenEncrypted;
			expect(after).toMatch(/^vault:v1:/);
			expect(after).not.toBe(before);
			expect(JSON.parse(t.vault.open(after)).refreshToken).toBe([...t.issuer.refreshTokens.keys()][0]);

			await t.refreshTokens.exchange(sid, PLATFORM);
			const grants = t.issuer.tokenRequests.map((request) => request.grantType);
			expect(grants).toEqual([
				'authorization_code',
				'refresh_token',
				'urn:ietf:params:oauth:grant-type:token-exchange',
				'urn:ietf:params:oauth:grant-type:token-exchange'
			]);
			expect(t.issuer.tokenRequests[2].params).toEqual({
				audience: 'platform-project-id',
				scope: 'apps:read',
				subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
				requested_token_type: 'urn:ietf:params:oauth:token-type:access_token'
			});
		});

		it('caps an exchanged token at an hour, whatever the issuer says', async () => {
			const { sid } = await linkedSignIn('person-long');
			t.issuer.exchangeExpiresIn = 86_400;
			const now = Math.floor(Date.now() / 1000);
			const delegated = await t.refreshTokens.exchange(sid, PLATFORM);
			expect(delegated.expiresAt).toBeLessThanOrEqual(now + 3600 - 60 + 2);
		});

		it('refreshes only once for concurrent requests (a rotated refresh token is used once)', async () => {
			const { sid } = await linkedSignIn('person-concurrent');
			const answers = await Promise.all([1, 2, 3].map(() => t.refreshTokens.exchange(sid, PLATFORM)));
			expect(answers.every((answer) => /^mock-xt-/.test(answer.token))).toBe(true);
			expect(t.issuer.tokenRequests.filter((request) => request.grantType === 'refresh_token')).toHaveLength(1);
		});

		it('removes a refresh token Ever ID refuses, and the person has to sign in again', async () => {
			const { userId, sid } = await linkedSignIn('person-refused');
			t.issuer.refreshTokens.clear();

			expect(await t.refreshTokens.exchange(sid, PLATFORM)).toBeNull();
			expect(t.sessions.recorded[0].everRefreshTokenEncrypted).toBeNull();
			expect(await t.refreshTokens.sessionOf(userId)).toBeNull();
		});

		describe('two API processes refreshing the same session at once (one refresh token, used once)', () => {
			/** The refresh token the session keeps right now, decrypted. */
			const storedRefreshToken = () => {
				const blob = t.sessions.recorded[0].everRefreshTokenEncrypted;
				return blob ? (JSON.parse(t.vault.open(blob)) as { refreshToken: string }).refreshToken : null;
			};

			it('keeps the rotated token when the refused process clears before the winner stores', async () => {
				const { userId, sid } = await linkedSignIn('person-race-clear');
				const winner = t.refreshTokens;
				const loser = t.replica();
				const release = deferred();
				const arrived = deferred();
				// The winner's refresh is checked and rotated at the issuer, then its answer is held.
				t.issuer.refreshHolds = [{ when: 'after', until: release.promise, arrived: arrived.resolve }];

				const winning = winner.exchange(sid, PLATFORM);
				await arrived.promise;
				// The other process sends the same, now used, refresh token: refused while the old one is still
				// stored, so it clears it (compare-and-clear) and gives nothing this time.
				expect(await loser.exchange(sid, PLATFORM)).toBeNull();
				expect(storedRefreshToken()).toBeNull();

				release.resolve();
				expect((await winning).token).toMatch(/^mock-xt-/);
				// The winner stored its rotated token for the session whatever was stored: it survives.
				const [live] = [...t.issuer.refreshTokens.keys()];
				expect(storedRefreshToken()).toBe(live);
				expect(await loser.sessionOf(userId)).toBe(sid);
				expect((await t.replica().exchange(sid, PLATFORM)).token).toMatch(/^mock-xt-/);
			});

			it('retries once with the token another process rotated meanwhile', async () => {
				const { userId, sid } = await linkedSignIn('person-race-retry');
				const late = t.replica();
				const release = deferred();
				const arrived = deferred();
				// The late process has read the stored token and sent it; the issuer holds it before checking it.
				t.issuer.refreshHolds = [{ when: 'before', until: release.promise, arrived: arrived.resolve }];

				const lateAnswer = late.exchange(sid, PLATFORM);
				await arrived.promise;
				// Meanwhile another process refreshes with the same token and stores the rotated one.
				expect((await t.refreshTokens.exchange(sid, PLATFORM)).token).toMatch(/^mock-xt-/);

				release.resolve();
				// Refused (its token was used), the late process reads the session again and retries with the new one.
				expect((await lateAnswer).token).toMatch(/^mock-xt-/);
				expect(t.issuer.tokenRequests.filter((request) => request.grantType === 'refresh_token')).toHaveLength(
					3
				);
				const [live] = [...t.issuer.refreshTokens.keys()];
				expect(storedRefreshToken()).toBe(live);
				expect(await late.sessionOf(userId)).toBe(sid);
			});
		});

		it('gives nothing once the session ended (back-channel logout), even with an access token in memory', async () => {
			const { userId, sid } = await linkedSignIn('person-logout');
			await t.refreshTokens.exchange(sid, PLATFORM);

			await t.sessions.endSessions(sid);
			expect(await t.refreshTokens.sessionOf(userId)).toBeNull();
			expect(await t.refreshTokens.exchange(sid, PLATFORM)).toBeNull();
		});

		it('discards a refresh that was in flight when the session ended: nothing exchanged, nothing held', async () => {
			const { sid } = await linkedSignIn('person-logout-in-flight');
			const release = deferred();
			const arrived = deferred();
			t.issuer.refreshHolds = [{ when: 'after', until: release.promise, arrived: arrived.resolve }];

			const answer = t.refreshTokens.exchange(sid, PLATFORM);
			await arrived.promise;
			await t.sessions.endSessions(sid);
			release.resolve();

			expect(await answer).toBeNull();
			expect(
				t.issuer.tokenRequests.filter((request) => request.grantType.includes('token-exchange'))
			).toHaveLength(0);
			expect(t.refreshTokens.cachedAccessTokens).toBe(0);
		});

		it('reports a refused exchange with a code only', async () => {
			const { sid } = await linkedSignIn('person-exchange-refused');
			t.issuer.exchangeError = { status: 400, error: 'invalid_target' };
			await expect(t.refreshTokens.exchange(sid, PLATFORM)).rejects.toEqual(
				new EverIdExchangeError('exchange_refused')
			);
			t.issuer.exchangeError = { status: 503, error: 'temporarily_unavailable' };
			await expect(t.refreshTokens.exchange(sid, PLATFORM)).rejects.toEqual(
				new EverIdExchangeError('issuer_unreachable')
			);
		});

		it('keeps nothing for a sign-in whose ID token names no session', async () => {
			const user = t.accounts.addUser({ email: 'person-without-session@example.test', tenantName: 'One' });
			await t.accounts.link([user], { issuer: t.issuer.issuer, subject: 'person-without-session' }, 'explicit');
			t.issuer.nextClaims = { sub: 'person-without-session', sid: undefined };
			await browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);
			expect(t.sessions.recorded).toEqual([
				expect.objectContaining({ sid: '', everRefreshTokenEncrypted: null })
			]);
			expect(await t.refreshTokens.sessionOf(user.id)).toBeNull();
		});
	});
});

describe('ZitadelRefreshTokenService without a way to encrypt the token', () => {
	it('keeps nothing, and says why once at start, without the connection plugin or without a safe secret', () => {
		const logs = captureLogs();
		try {
			const config = { settings: { launcherEnabled: true } } as never;
			const unsafe = new TestTokenVault();
			unsafe.safe = false;
			for (const vault of [undefined, unsafe]) {
				const service = new ZitadelRefreshTokenService(
					config,
					null as never,
					null as never,
					null as never,
					vault
				);
				service.onModuleInit();
				expect(service.keeping).toBe(false);
				expect(service.seal('https://idp.example.test', 'sid-1', 'refresh-token-value')).toBeNull();
			}
			expect(logs.lines.filter((line) => line.includes('keeps no Ever ID refresh token'))).toEqual([
				expect.stringContaining('needs the Ever Platform connection'),
				expect.stringContaining('set ENCRYPTION_KEY or a strong JWT_SECRET')
			]);
			expect(logs.lines.join('\n')).not.toContain('refresh-token-value');
		} finally {
			logs.restore();
		}
	});

	it('keeps nothing while the launcher is off, even with the encryption at hand', () => {
		const service = new ZitadelRefreshTokenService(
			{ settings: { launcherEnabled: false } } as never,
			null as never,
			null as never,
			null as never,
			new TestTokenVault()
		);
		expect(service.keeping).toBe(false);
		expect(service.seal('https://idp.example.test', 'sid-1', 'refresh-token-value')).toBeNull();
	});
});

describe('ZitadelRefreshTokenService memory of access tokens', () => {
	/** A refresh-token service with a small memory and a clock the test moves, over fakes that always refresh. */
	class SmallMemory extends ZitadelRefreshTokenService {
		protected override readonly maxCachedAccessTokens = 3;
		now = 1_800_000_000;
		protected override nowSeconds(): number {
			return this.now;
		}
	}

	function create(): { service: SmallMemory; refreshes: () => number } {
		const vault = new TestTokenVault();
		const issuer = {
			issuer: 'https://idp.example.test',
			clientId: 'web',
			clientSecret: 'secret',
			redirectUri: '',
			scopes: []
		};
		const blob = vault.seal(JSON.stringify({ v: 1, issuer: issuer.issuer, refreshToken: 'kept-refresh-token' }));
		let count = 0;
		const service = new SmallMemory(
			{ settings: { launcherEnabled: true }, issuer: async () => issuer } as never,
			{
				findOne: async () => ({ id: 'row', everRefreshTokenEncrypted: blob }),
				update: async () => ({ affected: 1 })
			} as never,
			{ get: async () => ({ token_endpoint: 'https://idp.example.test/oauth/v2/token' }) } as never,
			{
				postForm: async () => {
					count++;
					return { status: 200, data: { access_token: `access-${count}`, expires_in: 600 } };
				}
			} as never,
			vault
		);
		return { service, refreshes: () => count };
	}

	it('holds at most its limit, dropping the oldest, and uses a held token until a minute before it expires', async () => {
		const { service, refreshes } = create();
		for (const sid of ['s1', 's2', 's3', 's4']) {
			await service.accessTokenFor(sid);
		}
		expect(service.cachedAccessTokens).toBe(3);
		expect(refreshes()).toBe(4);

		// s4 is held: no refresh. s1 was dropped (the oldest): refreshed again.
		await service.accessTokenFor('s4');
		expect(refreshes()).toBe(4);
		await service.accessTokenFor('s1');
		expect(refreshes()).toBe(5);
		expect(service.cachedAccessTokens).toBe(3);

		// 600 s tokens are used for 540 s, then refreshed.
		service.now += 541;
		await service.accessTokenFor('s1');
		expect(refreshes()).toBe(6);
	});

	it('drops every expired token whenever it keeps a new one, full or not', async () => {
		const { service } = create();
		await service.accessTokenFor('s1');
		await service.accessTokenFor('s2');
		service.now += 541;
		await service.accessTokenFor('s3');
		// s1 and s2 had expired: both went with the next new token, although the memory was not full.
		expect(service.cachedAccessTokens).toBe(1);
		await service.accessTokenFor('s4');
		expect(service.cachedAccessTokens).toBe(2);
	});
});

// ---------------------------------------------------------------------------------------------------------------
// ZitadelSessionService: where the kept token goes with the session.
// ---------------------------------------------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose rows of a fake repository, as in the session service spec
type Row = Record<string, any>;

function matchesValue(actual: unknown, expected: unknown): boolean {
	if (!(expected instanceof FindOperator)) {
		return actual === expected;
	}
	switch (expected.type) {
		case 'in':
			return (expected.value as unknown[]).includes(actual);
		case 'isNull':
			return actual === null || actual === undefined;
		case 'not':
			return !matchesValue(actual, expected.child ?? expected.value);
		case 'lessThan':
			return (actual as number) < (expected.value as number);
		default:
			throw new Error(`Operator ${expected.type} is not supported by the fake repository`);
	}
}

class FakeRepository {
	readonly rows: Row[] = [];
	create(input: Row): Row {
		return { ...input };
	}
	async save(input: Row | Row[]): Promise<Row | Row[]> {
		for (const row of Array.isArray(input) ? input : [input]) {
			Object.assign(row, {
				id: row['id'] ?? randomUUID(),
				isActive: row['isActive'] ?? true,
				createdAt: row['createdAt'] ?? new Date()
			});
			this.rows.push(row);
		}
		return input;
	}
	async find(options: { where: Row }): Promise<Row[]> {
		return this.rows.filter((row) =>
			Object.entries(options.where).every(([key, value]) => matchesValue(row[key], value))
		);
	}
	async findOne(options: { where: Row }): Promise<Row | null> {
		return (await this.find(options))[0] ?? null;
	}
	async update(where: Row, patch: Row): Promise<{ affected: number }> {
		const found = await this.find({ where });
		found.forEach((row) => Object.assign(row, patch));
		return { affected: found.length };
	}
	async delete(where: Row): Promise<void> {
		const found = new Set(await this.find({ where }));
		for (let i = this.rows.length - 1; i >= 0; i--) {
			if (found.has(this.rows[i])) this.rows.splice(i, 1);
		}
	}
}

describe('ZitadelSessionService and the kept Ever ID refresh token', () => {
	let sessions: FakeRepository;
	let service: ZitadelSessionService;

	function create(launcherEnabled: boolean): ZitadelSessionService {
		return new ZitadelSessionService(
			sessions as never,
			new FakeRepository() as never,
			new FakeRepository() as never,
			new ZitadelStoreService(new InMemoryCache(), null),
			{ launcherEnabled } as never
		);
	}

	beforeEach(() => {
		sessions = new FakeRepository();
	});

	afterEach(() => {
		service?.onModuleDestroy();
	});

	it('stores the encrypted token on every record of the sign-in, and nothing without a session id or a token', async () => {
		service = create(true);
		await service.record('sid-1', [{ id: 'user-1' }, { id: 'user-2' }], 'v1:k:sealed');
		await service.record(undefined, [{ id: 'user-3' }], 'v1:k:sealed');
		await service.record('sid-4', [{ id: 'user-4' }]);
		expect(sessions.rows.map((row) => [row['userId'], row['everRefreshTokenEncrypted']])).toEqual([
			['user-1', 'v1:k:sealed'],
			['user-2', 'v1:k:sealed'],
			['user-3', null],
			['user-4', null]
		]);
	});

	it('removes the token when the identity provider ends the session before the sign-in finished', async () => {
		service = create(true);
		await service.record('sid-1', [{ id: 'user-1' }], 'v1:k:sealed');
		await service.endSessions('sid-1');
		expect(sessions.rows).toEqual([expect.objectContaining({ isActive: false, everRefreshTokenEncrypted: null })]);
	});

	it('removes the record, and the token with it, when the session ends after the sign-in finished', async () => {
		service = create(true);
		await service.record('sid-1', [{ id: 'user-1' }], 'v1:k:sealed');
		sessions.rows[0]['refreshTokenId'] = 'gauzy-refresh-token';
		await service.endSessions('sid-1');
		expect(sessions.rows).toEqual([]);
	});

	it('keeps tokens at pruning while the launcher is on, and removes every one once it is off', async () => {
		service = create(true);
		await service.record('sid-1', [{ id: 'user-1' }], 'v1:k:sealed');
		await service.prune();
		expect(sessions.rows[0]['everRefreshTokenEncrypted']).toBe('v1:k:sealed');

		service.onModuleDestroy();
		service = create(false);
		await service.prune();
		expect(sessions.rows).toEqual([expect.objectContaining({ sid: 'sid-1', everRefreshTokenEncrypted: null })]);
	});
});
