import { ConsoleLogger, Logger } from '@nestjs/common';
import { parseLookupRequest } from '../dto/lookup.dto';
import { problem } from '../fixtures/identity-harness';
import {
	IDENTIFIERS_DELETE,
	IDENTIFIERS_PUT,
	LOOKUP_PATH,
	lookupHarness,
	LookupHarness,
	setOrganizationIdentifiers
} from '../fixtures/lookup-harness';

/** A 64-hex token: a salted hash, whatever its kind. */
const HASH = /\b[0-9a-f]{64}\b/;

/**
 * No identifier value and no hash ever reaches a log line, an error the API answers or the audit:
 * the counterparty check and the discoverable upload log codes only, on success and on every
 * failure path.
 */
describe('the counterparty check and discoverability log no value and no hash', () => {
	let h: LookupHarness;
	const lines: string[] = [];
	const VALUES = [
		'BG123456789',
		'bg 123 456 789',
		'secret.person@example.com',
		'987654321',
		'DE999999999',
		'DE888888888'
	];

	beforeEach(async () => {
		lines.length = 0;
		const record = (...args: unknown[]) => {
			lines.push(
				args.map((arg) => (typeof arg === 'string' ? arg : (JSON.stringify(arg) ?? String(arg)))).join(' ')
			);
		};
		for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, method).mockImplementation(record as never);
			jest.spyOn(Logger, method).mockImplementation(record as never);
			jest.spyOn(ConsoleLogger.prototype, method).mockImplementation(record as never);
		}
		for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
			jest.spyOn(console, method).mockImplementation(record as never);
		}
		h = await lookupHarness();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await h.close();
	});

	const items = parseLookupRequest({
		items: [
			{ kind: 'vat', value: 'bg 123 456 789' },
			{ kind: 'email', value: 'secret.person@example.com' },
			{ kind: 'registration', value: '987654321', country: 'BG' }
		]
	}).items;

	/** Every answer and error a check gave, as text. */
	async function outcomes(): Promise<string[]> {
		const out: string[] = [];
		const attempt = async () => {
			try {
				out.push(JSON.stringify(await h.lookup.check(h.scope, items)));
			} catch (error) {
				out.push(
					String((error as Error).message),
					JSON.stringify((error as { response?: unknown }).response ?? null)
				);
			}
		};
		await h.setIntegration('counterparty_lookup', true);
		h.platform.on(LOOKUP_PATH, { status: 200, body: { salt_version: 1, matches: [] } });
		await attempt();
		await h.dataSource.query('DELETE FROM "ever_connect_lookup_cache"');
		for (const answer of [
			problem(500, 'internal'),
			problem(429, 'rate_limited'),
			problem(422, 'hashes_invalid'),
			problem(403, 'integration_disabled')
		]) {
			h.platform.on(LOOKUP_PATH, answer);
			await attempt();
		}
		h.platform.offline = true;
		await attempt();
		h.platform.offline = false;
		h.features['lookup'] = false;
		await attempt();
		return out;
	}

	it('on every outcome of a check', async () => {
		const answers = await outcomes();
		expect(lines.length + answers.length).toBeGreaterThan(0);
		for (const text of [...lines, ...answers]) {
			expect(text).not.toMatch(HASH);
			for (const value of VALUES) expect(text).not.toContain(value);
		}
		const audit = JSON.stringify(await h.auditRows());
		expect(audit).not.toMatch(HASH);
	});

	it('on every outcome of the discoverable upload and its removal', async () => {
		await setOrganizationIdentifiers(h, { taxId: 'DE999999999' });
		await h.setIntegration('counterparty_discoverable', true);
		for (const [answer, taxId] of [
			[problem(500, 'internal'), 'DE999999999'],
			[problem(409, 'identifier_claimed'), 'DE999999999'],
			[{ status: 200, body: { items: [] } }, 'DE888888888']
		] as const) {
			h.platform.on(IDENTIFIERS_PUT, answer);
			await h.discoverable.identifierChanged({
				tenantId: h.acme.tenantId,
				organizationId: h.acme.organizationId,
				taxId
			});
		}
		h.platform.offline = true;
		await h.discoverable.onDisable((await h.store.integration(h.link.linkId, 'counterparty_discoverable'))!);
		h.platform.offline = false;
		h.platform.on(IDENTIFIERS_DELETE, { status: 204 });
		await h.setIntegration('counterparty_discoverable', false);
		await h.discoverable.retry();
		expect(h.platform.callsTo(IDENTIFIERS_PUT).length).toBeGreaterThan(0);
		expect(h.platform.callsTo(IDENTIFIERS_DELETE).length).toBeGreaterThan(0);
		for (const text of lines) {
			expect(text).not.toMatch(HASH);
			for (const value of VALUES) expect(text).not.toContain(value);
		}
		const audit = JSON.stringify(await h.auditRows());
		expect(audit).toContain('identifiers.push');
		expect(audit).not.toMatch(HASH);
		expect(audit).not.toContain('DE999999999');
		expect(audit).not.toContain('DE888888888');
		// Nothing about the identifiers is stored in clear.
		const rows = JSON.stringify(await h.dataSource.query('SELECT * FROM "ever_connect_integration"'));
		expect(rows).not.toMatch(HASH);
		expect(rows).not.toContain('DE999999999');
	});

	it('a planted log line with a hash or a value would be caught (control)', () => {
		const planted = `checked ${'a'.repeat(64)} for BG123456789`;
		expect(planted).toMatch(HASH);
		expect(VALUES.some((value) => planted.includes(value))).toBe(true);
	});
});
