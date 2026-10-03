import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';
import { EverInstanceEvents, EverInstanceService, EverOperatorService } from '@gauzy/plugin-ever-instance';
import { EverStatsBuilder } from './ever-stats-builder.service';
import { EverStatsCollector } from './ever-stats-collector.service';
import { readEverStatsConfig } from './ever-stats-config';
import { EverStatsLifecycle } from './ever-stats.module';
import { EverStatsScheduler } from './ever-stats-scheduler.service';
import { EverStatsSender } from './ever-stats-sender.service';
import { EverStatsService } from './ever-stats.service';
import { EverStatsStore } from './ever-stats.store';
import { createCoreTables, insert, migrateUp, openTestDataSource, q } from './fixtures/test-db';

/**
 * End to end against the Ever Platform mock of ever-co/ever-connect-sdk (`tools/mock-platform`), an
 * independent implementation of the report endpoint (its own schema validation, signature check and
 * key pinning) that records every call it receives. CI runs it in `build-api` against the mock at a
 * pinned commit; locally:
 *
 *     node tools/mock-platform/bin/ever-mock-platform.mjs --port 18080
 *     EVER_STATS_MOCK_PLATFORM_URL=http://127.0.0.1:18080 yarn nx run plugin-ever-stats:test-mock-platform
 *
 * Without `EVER_STATS_MOCK_PLATFORM_URL` the suite is skipped, unless
 * `EVER_STATS_MOCK_PLATFORM_REQUIRED=true` (CI), where a missing mock fails it.
 *
 * - On: a fresh one-user installation with nothing but the mock's URL and a five-second day sends
 *   its first report within seconds; the mock accepts it, and it is the only kind of call made.
 * - `EVER_STATS_ENABLED=false`: nothing is created, scheduled or sent.
 * - Switched off in Settings: no call over several days, and *Send now* answers 409.
 * - Control: the "on" run without the mock does not pass, so a green run is not a blind one.
 */
const MOCK = process.env['EVER_STATS_MOCK_PLATFORM_URL'];
const REQUIRED = process.env['EVER_STATS_MOCK_PLATFORM_REQUIRED'] === 'true';
const suite = MOCK ? describe : describe.skip;

jest.setTimeout(120_000);

if (REQUIRED && !MOCK) {
	it('the mock platform is required here (EVER_STATS_MOCK_PLATFORM_REQUIRED=true), so EVER_STATS_MOCK_PLATFORM_URL must be set', () => {
		expect(MOCK).toBeDefined();
	});
}

async function mock<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${MOCK}${path}`, init);
	return (await response.json()) as T;
}

interface RecordedCall {
	method: string;
	path_template: string;
	status: number;
	user_agent?: string;
}

async function calls(): Promise<RecordedCall[]> {
	const body = await mock<RecordedCall[] | { requests: RecordedCall[] }>('/__mock/requests');
	return Array.isArray(body) ? body : body.requests;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		if (await check()) return true;
		await sleep(250);
	}
	return false;
}

/** A local port nothing listens on: the "mock removed" control. */
async function closedPort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as { port: number };
	await new Promise((resolve) => server.close(resolve));
	return port;
}

suite('against the Ever Platform mock', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		await mock('/__mock/reset', { method: 'POST' });
		dataSource = await openTestDataSource({ name: 'better-sqlite3' });
		await createCoreTables(dataSource, 'better-sqlite3');
		await migrateUp(dataSource);
		const tenantId = randomUUID();
		await insert(dataSource, 'better-sqlite3', 'tenant', { id: tenantId, name: 'Solo Consulting' });
		await insert(dataSource, 'better-sqlite3', 'user', { id: randomUUID(), tenantId, email: 'solo@solo.example', isActive: true });
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	/** The plugin as the module wires it, on `env` (the API's environment). */
	function plugin(env: Record<string, string>) {
		const config = readEverStatsConfig(env);
		const instanceEnv = { JWT_SECRET: 'e2e-secret', ...env };
		const instance = new EverInstanceService(dataSource, new EverInstanceEvents(), instanceEnv);
		const store = new EverStatsStore(dataSource);
		const collector = new EverStatsCollector(dataSource, { FEATURE_INVOICE: true });
		const scheduler = new EverStatsScheduler(config, instance, store, collector, new EverStatsBuilder(), new EverStatsSender(), undefined, 'v111.47.0', env);
		const service = new EverStatsService(config, instance, store, scheduler, collector, new EverStatsBuilder(), undefined, 'v111.47.0');
		const lifecycle = new EverStatsLifecycle(instance, new EverOperatorService(dataSource, instance, instanceEnv), scheduler, env);
		return { config, instance, store, scheduler, service, lifecycle };
	}

	/** Boots the plugin, waits up to `ms` for an accepted report, stops it. Whether one was accepted. */
	async function runOn(env: Record<string, string>, ms: number): Promise<{ accepted: boolean; stored: Awaited<ReturnType<EverStatsStore['latest']>> }> {
		const { lifecycle, scheduler, store } = plugin(env);
		await lifecycle.onApplicationBootstrap();
		try {
			const accepted = await until(async () => (await store.latest(1))[0]?.status === 'sent', ms);
			return { accepted, stored: await store.latest() };
		} finally {
			scheduler.stop();
		}
	}

	it('on: a fresh one-user installation with only the URL set sends a report the platform accepts, and nothing else', async () => {
		const env = { EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '5' };
		expect(readEverStatsConfig(env)).toMatchObject({ installSource: 'self-hosted', country: 'ZZ', serves: ['gauzy'], intervalS: 5 });
		const { accepted, stored } = await runOn(env, 30_000);
		expect(accepted).toBe(true);
		const recorded = await calls();
		expect(recorded.length).toBeGreaterThanOrEqual(1);
		expect(recorded.every((c) => c.method === 'POST' && c.path_template === '/v1/stats/reports' && c.status === 202)).toBe(true);
		expect(stored[0]).toMatchObject({ status: 'sent', httpStatus: 202 });
		expect(JSON.parse(stored[0].payload as string).counts).toMatchObject({ tenants: 1, users: 1 });
	});

	it('control: the same run without the mock platform does not pass', async () => {
		const env = { EVER_STATS_API_URL: `http://127.0.0.1:${await closedPort()}`, EVER_STATS_SEND_INTERVAL_S: '5' };
		const { accepted, stored } = await runOn(env, 15_000);
		expect(accepted).toBe(false);
		expect(stored[0]).toMatchObject({ status: 'failed', lastError: 'retry:connection_error' });
		expect(await calls()).toEqual([]);
	});

	it('EVER_STATS_ENABLED=false: nothing is created, scheduled or sent over several days', async () => {
		const env = { EVER_STATS_ENABLED: 'false', EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '1' };
		const { lifecycle, scheduler, store } = plugin(env);
		await lifecycle.onApplicationBootstrap();
		expect(scheduler.nextSendAt()).toBeNull();
		await sleep(4_000);
		expect((await scheduler.runSlot('send_now')).skipped).toBe('env');
		scheduler.stop();
		expect(await calls()).toEqual([]);
		expect(await store.latest()).toEqual([]);
		expect(await dataSource.query(`SELECT * FROM ${q('better-sqlite3', 'ever_instance')}`)).toEqual([]);
	});

	it('switched off in Settings: no call over several days, and Send now is refused with 409', async () => {
		const env = { EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '1' };
		const { instance, lifecycle, scheduler, service, store } = plugin(env);
		await instance.ensure();
		await instance.setStatsEnabledUi(false, 'operator');
		await lifecycle.onApplicationBootstrap();
		await sleep(4_000);
		for (let i = 0; i < 3; i += 1) {
			expect((await scheduler.runSlot('schedule')).skipped).toBe('ui');
		}
		await expect(service.sendNow()).rejects.toMatchObject({ status: 409 });
		scheduler.stop();
		expect(await calls()).toEqual([]);
		expect(await store.latest()).toEqual([]);
	});

	it('the same identity is accepted again (its key was pinned on first sight)', async () => {
		const { scheduler } = plugin({ EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '5' });
		expect((await scheduler.runSlot('send_now')).reports[0]).toMatchObject({ status: 'sent', httpStatus: 202 });
		expect((await scheduler.runSlot('send_now')).reports[0]).toMatchObject({ status: 'sent', httpStatus: 202 });
	});

	it('a report signed with another key for the same id is refused with 409, and nothing more is sent for that id', async () => {
		const first = plugin({ EVER_STATS_API_URL: MOCK as string });
		expect((await first.scheduler.runSlot('send_now')).reports[0].status).toBe('sent');
		// Same id, new key: what a copy of the database with a regenerated key would send.
		const identity = await first.instance.get();
		await first.instance.resetIdentity('operator');
		await dataSource.query(`UPDATE "ever_instance" SET "instanceId" = '${identity?.instanceId}'`);
		const second = await first.scheduler.runSlot('send_now');
		expect(second.reports[0]).toMatchObject({ status: 'rejected', httpStatus: 409 });
		expect((await first.scheduler.runSlot('send_now')).skipped).toBe('blocked');
	});
});
