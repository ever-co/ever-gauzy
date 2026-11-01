import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVER_CONNECT_CONFIG } from '@gauzy/plugin-auth-zitadel';
import { EVER_CONNECT_CONFIG_PROVIDER } from '../ever-connect-config.provider';
import { OIDC_CLIENT_POLL_FIRST_MS, OIDC_CLIENT_POLL_MAX_MS, RESOLVE_TIMEOUT_MS } from '../ever-connect.constants';
import { EVER_ID_LOGIN, EverIdLoginHandler } from '../handlers/ever-id-login.handler';
import { identityHarness, IdentityHarness, ISSUER, problem } from '../fixtures/identity-harness';

/**
 * Sign in with Ever ID's client hand-off, against a recording stand-in for Ever Platform through the
 * real SDK client: asked for once when the integration is enabled (with this API's callback and
 * back-channel logout addresses), read until it is ready, its secret (handed over once) stored
 * sealed, given to the Ever ID sign-in plugin, and forgotten when the integration ends. Ever
 * Platform's view of an identity is asked for its own issuer only, and never holds a sign-in up.
 */
describe('Sign in with Ever ID: the sign-in client', () => {
	let h: IdentityHarness;
	const SECRET = 'ics_secret_handed_over_once';
	const POST = 'POST /v1/instances/me/oidc-client';
	const GET = 'GET /v1/instances/me/oidc-client';

	beforeEach(async () => {
		h = await identityHarness();
	});

	afterEach(async () => {
		await h.close();
	});

	/** Ever Platform answers pending `pendingReads` times, then ready with the secret once. */
	function platformMakesTheClient(pendingReads = 1) {
		let reads = 0;
		let shown = false;
		h.platform.on(POST, { status: 202, body: { status: 'pending', job_id: '01JD0000000000000000000J0B' } });
		h.platform.on(GET, () => {
			reads++;
			if (reads <= pendingReads) return { status: 200, body: { status: 'pending', job_id: '01JD0000000000000000000J0B' } };
			const body: Record<string, unknown> = {
				status: 'ready',
				job_id: '01JD0000000000000000000J0B',
				issuer: `${ISSUER}/`,
				client_id: 'inst-01JNE7V9J03J6XQ2WN8H0Z88R5'
			};
			if (!shown) body['client_secret'] = SECRET;
			shown = true;
			return { status: 200, body };
		});
	}

	async function storedBlob(): Promise<string | null> {
		return (await h.store.integration('instance', EVER_ID_LOGIN))?.configEncrypted ?? null;
	}

	it('asks once with the callback and back-channel logout addresses, then reads it until ready (pending, then ready)', async () => {
		platformMakesTheClient(1);
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		expect(h.platform.callsTo(POST)).toHaveLength(1);
		// The body is exactly the SDK's request (the client refuses anything else before it is sent).
		expect(h.platform.callsTo(POST)[0].body).toEqual({
			redirect_uri: 'https://gauzy.example.com/api/auth/zitadel/callback',
			logout_uri: 'https://gauzy.example.com/api/auth/zitadel/backchannel-logout'
		});
		expect(h.platform.callsTo(POST)[0].headers['idempotency-key']).toBeUndefined();
		expect(await h.everIdLogin.status()).toBe('pending');
		expect(await h.everIdLogin.getEverIdLoginConfig()).toBeNull();

		// Not due yet: nothing is read.
		expect(await h.everIdLogin.pollDue()).toBe(false);
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
		expect(await h.everIdLogin.pollDue()).toBe(true);
		expect(await h.everIdLogin.status()).toBe('pending');
		// Read again later, then less often.
		expect(await h.everIdLogin.pollDue()).toBe(false);
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS * 2;
		expect(await h.everIdLogin.pollDue()).toBe(true);
		expect(await h.everIdLogin.status()).toBe('ready');
		expect(h.platform.callsTo(GET)).toHaveLength(2);

		// Enabled again (a page re-read): nothing more is asked for.
		await h.everIdLogin.enabled();
		expect(h.platform.callsTo(POST)).toHaveLength(1);
	});

	it('stores the secret sealed (never in clear) and gives it to the Ever ID sign-in plugin', async () => {
		platformMakesTheClient(0);
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
		await h.everIdLogin.pollDue();
		const blob = await storedBlob();
		expect(blob).toMatch(/^v1:/);
		expect(blob).not.toContain(SECRET);
		expect(blob).not.toContain('inst-');
		const all = JSON.stringify(await h.dataSource.query('SELECT * FROM "ever_connect_integration"'));
		expect(all).not.toContain(SECRET);
		const audit = JSON.stringify(await h.auditRows());
		expect(audit).not.toContain(SECRET);
		expect(audit).toContain('sign_in_client.change');

		expect(await h.everIdLogin.isEverIdLoginEnabled()).toBe(true);
		expect(await h.everIdLogin.getEverIdLoginConfig()).toEqual({
			issuer: ISSUER,
			clientId: 'inst-01JNE7V9J03J6XQ2WN8H0Z88R5',
			clientSecret: SECRET
		});
		// Another API process with the same secrets reads the same client.
		const other = new EverIdLoginHandler(h.store, h.platformService as never, h.audit, h.signals, h.config, { ENCRYPTION_KEY: 'identity-spec-encryption-key-0123456789' }, h.clock);
		expect((await other.getEverIdLoginConfig())?.clientSecret).toBe(SECRET);
	});

	it('is provided to the Ever ID sign-in plugin as EVER_CONNECT_CONFIG', () => {
		expect(EVER_CONNECT_CONFIG_PROVIDER).toEqual({ provide: EVER_CONNECT_CONFIG, useExisting: EverIdLoginHandler });
	});

	it('is cleared when the integration ends (switched off, revoked or disconnected); the next enable asks again', async () => {
		platformMakesTheClient(0);
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
		await h.everIdLogin.pollDue();
		expect(await h.everIdLogin.status()).toBe('ready');

		await h.store.saveIntegration('instance', EVER_ID_LOGIN, { state: 'revoked_remote', enabled: false });
		await h.everIdLogin.disabled();
		expect(await storedBlob()).toBeNull();
		expect(await h.everIdLogin.status()).toBe('none');
		expect(await h.everIdLogin.isEverIdLoginEnabled()).toBe(false);
		expect(await h.everIdLogin.getEverIdLoginConfig()).toBeNull();

		// Enabled again after a new consent: a new request (Ever Platform reuses the app with a new secret).
		await h.store.saveIntegration('instance', EVER_ID_LOGIN, { state: 'enabled', enabled: true });
		await h.everIdLogin.enabled();
		expect(h.platform.callsTo(POST)).toHaveLength(2);
	});

	it('a client handed over before (another process, a restart) is read; a secret not stored here reads "enable again"', async () => {
		h.platform.on(POST, problem(409, 'oidc_client_exists'));
		h.platform.on(GET, { status: 200, body: { status: 'ready', job_id: null, issuer: ISSUER, client_id: 'inst-x' } });
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		expect(await h.everIdLogin.status()).toBe('pending');
		await h.everIdLogin.pollDue();
		expect(await h.everIdLogin.status()).toBe('lost');
		expect(await h.everIdLogin.getEverIdLoginConfig()).toBeNull();
	});

	it('a client that cannot be read with this process secrets reads "unreadable", never a wrong client', async () => {
		platformMakesTheClient(0);
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		const changedKey = new EverIdLoginHandler(h.store, h.platformService as never, h.audit, h.signals, h.config, { ENCRYPTION_KEY: 'another-encryption-key-after-a-change-000' }, h.clock);
		expect(await changedKey.status()).toBe('unreadable');
		expect(await changedKey.getEverIdLoginConfig()).toBeNull();
	});

	it('Ever Platform refusing the addresses ends the request failed; unusable local addresses are never sent', async () => {
		h.platform.on(POST, problem(422, 'redirect_uri_invalid'));
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		expect(await h.everIdLogin.status()).toBe('failed');

		const local = await identityHarness({ ENCRYPTION_KEY: 'identity-spec-encryption-key-0123456789', API_BASE_URL: 'http://10.0.0.5:3000' });
		try {
			await local.connectAndEnable();
			await local.everIdLogin.enabled();
			expect(local.platform.calls).toEqual([]);
			expect(await local.everIdLogin.status()).toBe('failed');
		} finally {
			await local.close();
		}
	});

	it('nothing is asked for when not connected or not enabled; an unreachable platform is retried by the caller', async () => {
		platformMakesTheClient(0);
		await h.everIdLogin.enabled();
		expect(h.platform.calls).toEqual([]);
		await h.store.updateConnection({ status: 'connected', platformInstanceId: '01JNE7V9J03J6XQ2WN8H0Z88R5' });
		await h.everIdLogin.enabled();
		expect(h.platform.calls).toEqual([]);

		await h.connectAndEnable();
		h.platform.offline = true;
		await expect(h.everIdLogin.enabled()).rejects.toThrow();
		expect(await h.everIdLogin.status()).toBe('none');
	});

	it('the worker asks again when the first request failed (a restart, another process), less often while it fails', async () => {
		platformMakesTheClient(0);
		await h.connectAndEnable();
		h.platform.offline = true;
		await expect(h.everIdLogin.enabled()).rejects.toThrow();
		// A new process (the in-memory retry of the first one is gone): the worker asks.
		const worker = new EverIdLoginHandler(h.store, h.platformService as never, h.audit, h.signals, h.config, { ENCRYPTION_KEY: 'identity-spec-encryption-key-0123456789', API_BASE_URL: 'https://gauzy.example.com' }, h.clock);
		expect(await worker.ensureRequested()).toBe(true);
		expect(await worker.status()).toBe('none');
		// Backing off: not again at once.
		expect(await worker.ensureRequested()).toBe(false);
		h.platform.offline = false;
		h.clock.t += 30_000;
		expect(await worker.ensureRequested()).toBe(true);
		expect(await worker.status()).toBe('pending');
		// Asked for: nothing more to ask.
		h.clock.t += 3_600_000;
		expect(await worker.ensureRequested()).toBe(false);
		// Two attempts while offline, then the one that went through.
		expect(h.platform.callsTo(POST)).toHaveLength(3);
	});

	it('Ever Platform not holding the integration as enabled yet (403) is retried, never left without a client', async () => {
		h.platform.on(POST, problem(403, 'integration_disabled'));
		await h.connectAndEnable();
		await expect(h.everIdLogin.enabled()).rejects.toThrow();
		expect(await h.everIdLogin.status()).toBe('none');
		h.platform.on(POST, { status: 202, body: { status: 'pending', job_id: null } });
		expect(await h.everIdLogin.ensureRequested()).toBe(true);
		expect(await h.everIdLogin.status()).toBe('pending');
	});

	it('switched off while its client was being asked for: nothing is kept for it', async () => {
		await h.connectAndEnable();
		h.platform.on(POST, async () => {
			// The operator switches it off while the request is on its way.
			await h.store.saveIntegration('instance', EVER_ID_LOGIN, { state: 'disabled', enabled: false });
			await h.everIdLogin.disabled();
			return { status: 202, body: { status: 'pending', job_id: null } };
		});
		await h.everIdLogin.enabled();
		expect(await storedBlob()).toBeNull();
		// Enabled again: asked for again.
		h.platform.on(POST, { status: 202, body: { status: 'pending', job_id: null } });
		await h.store.saveIntegration('instance', EVER_ID_LOGIN, { state: 'enabled', enabled: true });
		await h.everIdLogin.enabled();
		expect(await h.everIdLogin.status()).toBe('pending');
	});

	it('the existing links stay due per linked tenant until they were queued, once the client is ready', async () => {
		platformMakesTheClient(0);
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		expect(await h.everIdLogin.backfillDue(['t1'])).toEqual([]);
		h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
		await h.everIdLogin.pollDue();
		expect(await h.everIdLogin.backfillDue(['t1', 't1'])).toEqual(['t1']);
		await h.everIdLogin.markBackfilled(['t1']);
		expect(await h.everIdLogin.backfillDue(['t1'])).toEqual([]);
		// A tenant linked later is due then.
		expect(await h.everIdLogin.backfillDue(['t1', 't2'])).toEqual(['t2']);
		// Still the same client.
		expect((await h.everIdLogin.getEverIdLoginConfig())?.clientSecret).toBe(SECRET);
	});

	it('reads less often while it stays pending (at most every 5 minutes) and keeps going when a read fails', async () => {
		h.platform.on(POST, { status: 202, body: { status: 'pending', job_id: '01JD0000000000000000000J0B' } });
		h.platform.on(GET, problem(503, 'unavailable'));
		await h.connectAndEnable();
		await h.everIdLogin.enabled();
		for (let i = 0; i < 12; i++) {
			h.clock.t += OIDC_CLIENT_POLL_MAX_MS;
			expect(await h.everIdLogin.pollDue()).toBe(true);
		}
		expect(await h.everIdLogin.status()).toBe('pending');
		h.clock.t += OIDC_CLIENT_POLL_MAX_MS - 1;
		expect(await h.everIdLogin.pollDue()).toBe(false);
	});

	describe('Ever Platform view of an identity (resolve)', () => {
		async function ready() {
			platformMakesTheClient(0);
			await h.connectAndEnable();
			await h.everIdLogin.enabled();
			h.clock.t += OIDC_CLIENT_POLL_FIRST_MS;
			await h.everIdLogin.pollDue();
		}

		it('asks for Ever Platform issuer only, with the issuer and subject', async () => {
			await ready();
			h.platform.on('POST /v1/identity/resolve', {
				status: 200,
				body: { person: { id: 'P1' }, identity: { kind: 'personal' }, orgs_filtered: [] }
			});
			expect(await h.everIdLogin.resolveIdentity(ISSUER, '275396402232829475')).toMatchObject({ person: { id: 'P1' } });
			expect(h.platform.callsTo('POST /v1/identity/resolve')[0].body).toEqual({ issuer: ISSUER, subject: '275396402232829475' });

			// Another identity provider's subject never leaves the installation.
			expect(await h.everIdLogin.resolveIdentity('https://login.acme.example', 'abc')).toBeNull();
			expect(h.platform.callsTo('POST /v1/identity/resolve')).toHaveLength(1);
		});

		it('answers null for an unknown subject, an error, or when the integration is off', async () => {
			await ready();
			h.platform.on('POST /v1/identity/resolve', problem(404, 'not_found'));
			expect(await h.everIdLogin.resolveIdentity(ISSUER, 'unknown')).toBeNull();
			h.platform.on('POST /v1/identity/resolve', problem(500, 'internal'));
			expect(await h.everIdLogin.resolveIdentity(ISSUER, 'x')).toBeNull();
			await h.store.saveIntegration('instance', EVER_ID_LOGIN, { state: 'disabled', enabled: false });
			await h.everIdLogin.disabled();
			const before = h.platform.calls.length;
			expect(await h.everIdLogin.resolveIdentity(ISSUER, 'x')).toBeNull();
			expect(h.platform.calls.length).toBe(before);
		});

		it('gives up after 6 seconds (a sign-in goes on without it)', async () => {
			await ready();
			h.platform.on('POST /v1/identity/resolve', () => new Promise(() => undefined));
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const answer = h.everIdLogin.resolveIdentity(ISSUER, 'slow');
				await jest.advanceTimersByTimeAsync(RESOLVE_TIMEOUT_MS);
				await expect(answer).resolves.toBeNull();
			} finally {
				jest.useRealTimers();
			}
		});
	});

	it('the plugin sources never log or audit the client secret (no secret-bearing field in a log line)', () => {
		const source = readFileSync(join(__dirname, '../handlers/ever-id-login.handler.ts'), 'utf8');
		for (const line of source.split('\n').filter((l) => /logger\.|audit\.record/.test(l))) {
			expect(line).not.toMatch(/clientSecret|client_secret/);
		}
	});
});
