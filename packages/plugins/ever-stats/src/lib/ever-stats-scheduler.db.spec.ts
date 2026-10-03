import { createPublicKey, verify } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvents, EverInstanceService } from '@gauzy/plugin-ever-instance';
import { EverStatsBuilder } from './ever-stats-builder.service';
import { EverStatsCollector } from './ever-stats-collector.service';
import { EverStatsConfig } from './ever-stats-config';
import { EverStatsScheduler, StatsClock } from './ever-stats-scheduler.service';
import { EverStatsSender } from './ever-stats-sender.service';
import { EverStatsStore } from './ever-stats.store';
import { EverStatsService } from './ever-stats.service';
import { CORE_TABLES, createCoreTables, dropTables, globalStatsOver, migrateUp, openTestDataSource, PLUGIN_TABLES, q, TEST_TARGETS } from './fixtures/test-db';

const ENV = { JWT_SECRET: 'a-strong-jwt-secret-for-tests' };
const DAY = 86_400_000;
const CONFIG: EverStatsConfig = { apiUrl: 'http://mock-platform:8080', country: 'ZZ', serves: ['gauzy'], intervalS: 86_400, installSource: 'self-hosted' };

interface Call {
	url: string;
	headers: Record<string, string>;
	body: Buffer;
}

/** A `fetch` that records each request and answers with the next status of `statuses` (202 when empty). */
function recordingFetch(calls: Call[], statuses: Array<number | 'reset'> = []) {
	return (async (url: string, init: RequestInit) => {
		calls.push({ url, headers: init.headers as Record<string, string>, body: Buffer.from(init.body as Buffer) });
		const next = statuses.shift() ?? 202;
		if (next === 'reset') throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
		const body = next === 202 ? { accepted: true } : next === 409 ? { code: 'key_mismatch' } : { code: 'schema_violation', errors: [{ path: '/counts', code: 'type' }] };
		return new Response(JSON.stringify(body), { status: next, headers: { 'content-type': 'application/json' } });
	}) as unknown as typeof fetch;
}

class FakeClock implements StatsClock {
	constructor(public at: number) {}
	now() {
		return this.at;
	}
	random() {
		return 0.5;
	}
}

// Creating and dropping tables on a real Postgres or MySQL takes longer than the default 5 s.
jest.setTimeout(120_000);

describe.each(TEST_TARGETS)('EverStatsScheduler on $name', (target) => {
	let dataSource: DataSource;
	const d = target.name;

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	beforeEach(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		await migrateUp(dataSource);
	});

	function setup(clock: FakeClock, calls: Call[], statuses: Array<number | 'reset'> = [], config = CONFIG) {
		const instance = new EverInstanceService(dataSource, new EverInstanceEvents(), ENV);
		const store = new EverStatsStore(dataSource);
		const collector = new EverStatsCollector(globalStatsOver(dataSource, d), dataSource, { FEATURE_INVOICE: true }, (work) => work());
		const sender = new EverStatsSender(recordingFetch(calls, statuses));
		const scheduler = new EverStatsScheduler(config, instance, store, collector, new EverStatsBuilder(), sender, clock, 'v111.47.0');
		return { instance, store, scheduler };
	}

	const reportRows = async () => Number((await dataSource.query(`SELECT COUNT(*) AS n FROM ${q(d, 'ever_stats_report')}`))[0].n);

	it('signs exactly the stored bytes and sends them; the platform key verifies them', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const { instance, store, scheduler } = setup(clock, calls);
		const identity = await instance.ensure();
		const result = await scheduler.runSlot('schedule');
		expect(result.reports).toEqual([{ period: '2026-10', final: false, status: 'sent', httpStatus: 202, error: null }]);
		expect(calls).toHaveLength(1);
		const [row] = await store.latest();
		expect(Buffer.from(row.payload as string, 'utf8').equals(calls[0].body)).toBe(true);
		expect(calls[0].url).toBe('http://mock-platform:8080/v1/stats/reports');
		expect(calls[0].headers['Ever-Stats-Key']).toBe(identity.statsPublicKey);
		const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: identity.statsPublicKey }, format: 'jwk' });
		const signature = Buffer.from(calls[0].headers['Ever-Stats-Signature'].replace('ed25519=', ''), 'base64url');
		expect(verify(null, Buffer.from(row.payload as string, 'utf8'), key, signature)).toBe(true);
		const report = JSON.parse(row.payload as string);
		expect(report).toMatchObject({ instance_id: identity.instanceId, version: '111.47.0', channel: 'stable', period: '2026-10', final: false, sent_at: '2026-10-15' });
		expect((await store.readLease()).lastSentAt).toBe(clock.at);
	});

	it('makes no request at all over three slots while the operator switch is off', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const { instance, scheduler } = setup(clock, calls);
		await instance.ensure();
		await instance.setStatsEnabledUi(false, 'operator');
		for (let i = 0; i < 3; i += 1) {
			expect((await scheduler.runSlot('schedule')).skipped).toBe('ui');
			clock.at += DAY;
		}
		expect(calls).toHaveLength(0);
		expect(await reportRows()).toBe(0);
	});

	it('re-sends the previous month once with final: true on days 1 to 3', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 2, 10));
		const calls: Call[] = [];
		const { scheduler } = setup(clock, calls);
		const first = await scheduler.runSlot('schedule');
		expect(first.reports.map((r) => [r.period, r.final, r.status])).toEqual([
			['2026-09', true, 'sent'],
			['2026-10', false, 'sent']
		]);
		clock.at += DAY;
		const second = await scheduler.runSlot('schedule');
		expect(second.reports.map((r) => [r.period, r.final])).toEqual([['2026-10', false]]);
		expect(calls).toHaveLength(3);
	});

	it('sends once per slot when two API processes share the database', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const a = setup(clock, calls);
		const b = setup(clock, calls);
		const results = await Promise.all([a.scheduler.runSlot('schedule'), b.scheduler.runSlot('schedule')]);
		expect(calls).toHaveLength(1);
		expect(results.map((r) => r.skipped ?? 'sent').sort()).toEqual(expect.arrayContaining(['sent']));
		clock.at += 60_000;
		expect((await b.scheduler.runSlot('schedule')).skipped).toBe('already_sent');
		expect(calls).toHaveLength(1);
	});

	it('keeps the last 12 reports', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 10, 10));
		const calls: Call[] = [];
		const { scheduler } = setup(clock, calls);
		for (let i = 0; i < 15; i += 1) {
			await scheduler.runSlot('send_now');
			clock.at += 60_000;
		}
		expect(calls).toHaveLength(15);
		expect(await reportRows()).toBe(12);
	});

	it('records every answer, and stops after a refusal until the identity changes', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const { instance, store, scheduler } = setup(clock, calls, [503, 'reset', 429, 404, 422]);
		const expected: Array<[string, number | null, string]> = [
			['failed', 503, 'retry:http_503:schema_violation:/counts:type'],
			['failed', null, 'retry:connection_error'],
			['failed', 429, 'retry:http_429:schema_violation:/counts:type'],
			['failed', 404, 'later:http_404:schema_violation:/counts:type'],
			['rejected', 422, 'dropped:http_422:schema_violation:/counts:type']
		];
		for (const [status, http, error] of expected) {
			const result = await scheduler.runSlot('send_now');
			expect(result.reports[0]).toMatchObject({ status, httpStatus: http, error });
			clock.at += 60_000;
		}
		expect((await scheduler.runSlot('send_now')).skipped).toBe('blocked');
		expect(calls).toHaveLength(5);
		await instance.resetIdentity('operator');
		expect((await scheduler.runSlot('send_now')).reports[0].status).toBe('sent');
		const rows = await store.latest();
		expect(rows[0].status).toBe('sent');
	});

	it('a failed send makes every API process wait for its retry time, not only the one that sent', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const a = setup(clock, calls, [503]);
		const b = setup(clock, calls);
		expect((await a.scheduler.runSlot('schedule')).reports[0]).toMatchObject({ status: 'failed', httpStatus: 503 });
		clock.at += 30 * 60_000;
		expect((await b.scheduler.runSlot('schedule')).skipped).toBe('retry_pending');
		clock.at += 31 * 60_000;
		expect((await b.scheduler.runSlot('schedule')).reports[0]).toMatchObject({ status: 'sent' });
		expect(calls).toHaveLength(2);
	});

	it('Send now waits 10 minutes after the newest report, whichever process sent it; the last payload is the current identity one', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const a = setup(clock, calls);
		const b = setup(clock, calls);
		const service = (s: ReturnType<typeof setup>) =>
			new EverStatsService(CONFIG, s.instance, s.store, s.scheduler, undefined as never, undefined as never, clock, 'v111.47.0');
		await service(a).sendNow();
		clock.at += 5 * 60_000;
		await expect(service(b).sendNow()).rejects.toThrow('once every 10 minutes');
		clock.at += 6 * 60_000;
		await service(b).sendNow();
		expect(calls).toHaveLength(2);
		expect((await service(a).last())?.http_status).toBe(202);
		await a.instance.resetIdentity('operator');
		expect(await service(a).last()).toBeNull();
	});

	it('marks 409 key_mismatch for a reset and sends nothing more for that identity', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const { scheduler } = setup(clock, calls, [409]);
		expect((await scheduler.runSlot('send_now')).reports[0]).toMatchObject({ status: 'rejected', httpStatus: 409 });
		expect((await scheduler.runSlot('send_now')).skipped).toBe('blocked');
		expect(calls).toHaveLength(1);
	});

	it('retries at +1 h, +4 h, +12 h, then the next day; a success goes back to one send a day', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const calls: Call[] = [];
		const { scheduler } = setup(clock, calls, [503, 503, 503, 503]);
		const waits: number[] = [];
		for (let i = 0; i < 4; i += 1) {
			const result = await scheduler.runSlot('schedule');
			const next = scheduler.nextAfter(result);
			waits.push(next - clock.at);
			clock.at = next;
		}
		expect(waits).toEqual([3_600_000, 14_400_000, 43_200_000, 86_400_000]);
		const ok = await scheduler.runSlot('schedule');
		expect(ok.reports[0].status).toBe('sent');
		const next = scheduler.nextAfter(ok);
		const dayStart = Math.floor(clock.at / DAY) * DAY;
		expect(next).toBe(dayStart + DAY + DAY / 2);
	});

	it('first send: a day after the identity was made; ten minutes after boot when overdue', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const { scheduler } = setup(clock, []);
		const created = clock.at;
		expect(scheduler.firstSendAt({ createdAt: created }, null, clock.at)).toBe(created + DAY + 30 * 60_000);
		expect(scheduler.firstSendAt({ createdAt: created - 2 * DAY }, null, clock.at)).toBe(clock.at + 10 * 60_000 + 5 * 60_000);
		expect(scheduler.firstSendAt({ createdAt: created - 2 * DAY }, clock.at - 2 * DAY, clock.at)).toBe(clock.at + 15 * 60_000);
		const lastSent = Date.UTC(2026, 9, 15, 1);
		expect(scheduler.firstSendAt({ createdAt: created - 9 * DAY }, lastSent, clock.at)).toBe(Date.UTC(2026, 9, 16) + DAY / 2);
	});

	it('with a five-second day (tests), the first report goes out within seconds of boot', async () => {
		const clock = new FakeClock(Date.UTC(2026, 9, 15, 10));
		const { scheduler, instance } = setup(clock, [], [], { ...CONFIG, intervalS: 5 });
		const identity = await instance.ensure();
		expect(scheduler.firstSendAt(identity, null, clock.at) - clock.at).toBeLessThanOrEqual(10_000);
	});
});
