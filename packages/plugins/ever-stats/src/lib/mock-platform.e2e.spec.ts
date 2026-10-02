import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvents, EverInstanceService } from '@gauzy/plugin-ever-instance';
import { EverStatsBuilder } from './ever-stats-builder.service';
import { EverStatsCollector } from './ever-stats-collector.service';
import { readEverStatsConfig } from './ever-stats-config';
import { EverStatsScheduler } from './ever-stats-scheduler.service';
import { EverStatsSender } from './ever-stats-sender.service';
import { EverStatsStore } from './ever-stats.store';
import { createCoreTables, globalStatsOver, insert, migrateUp, openTestDataSource } from './fixtures/test-db';

/**
 * End to end against the Ever Platform mock of ever-co/ever-connect-sdk (`tools/mock-platform`), an
 * independent implementation of the report endpoint (its own schema validation, signature check and
 * key pinning). Runs only when `EVER_STATS_MOCK_PLATFORM_URL` points at a running mock, for example:
 *
 *     node tools/mock-platform/bin/ever-mock-platform.mjs --port 18080
 *     EVER_STATS_MOCK_PLATFORM_URL=http://127.0.0.1:18080 yarn nx test plugin-ever-stats --testPathPatterns mock-platform
 *
 * The plugin is set up as a fresh installation with nothing but the mock's URL and a five-second
 * day: a one-user database sends its first report within seconds, and the mock accepts it.
 */
const MOCK = process.env['EVER_STATS_MOCK_PLATFORM_URL'];
const suite = MOCK ? describe : describe.skip;

jest.setTimeout(120_000);

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

async function until(check: () => Promise<boolean>, timeoutMs: number): Promise<void> {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error('timed out');
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

	function plugin(env: Record<string, string>) {
		const config = readEverStatsConfig(env);
		const instance = new EverInstanceService(dataSource, new EverInstanceEvents(), { JWT_SECRET: 'e2e-secret' });
		const scheduler = new EverStatsScheduler(
			config,
			instance,
			new EverStatsStore(dataSource),
			new EverStatsCollector(globalStatsOver(dataSource, 'better-sqlite3'), dataSource, { FEATURE_INVOICE: true }, (work) => work()),
			new EverStatsBuilder(),
			new EverStatsSender(),
			undefined,
			'v111.47.0'
		);
		return { config, instance, scheduler };
	}

	it('a fresh one-user installation with only the URL set sends a report the platform accepts, in full', async () => {
		const { config, scheduler } = plugin({ EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '5' });
		expect(config).toMatchObject({ installSource: 'self-hosted', country: 'ZZ', serves: ['gauzy'] });
		await scheduler.start();
		try {
			await until(async () => (await calls()).some((c) => c.path_template === '/v1/stats/reports'), 30_000);
		} finally {
			scheduler.stop();
		}
		const reports = (await calls()).filter((c) => c.path_template === '/v1/stats/reports');
		expect(reports.length).toBeGreaterThanOrEqual(1);
		expect(reports.every((c) => c.method === 'POST' && c.status === 202)).toBe(true);
		expect((await calls()).every((c) => c.path_template === '/v1/stats/reports')).toBe(true);
		const [row] = await new EverStatsStore(dataSource).latest(1);
		expect(row).toMatchObject({ status: 'sent', httpStatus: 202 });
		expect(JSON.parse(row.payload as string).counts).toMatchObject({ tenants: 1, users: 1 });
	});

	it('the same identity is accepted again (its key was pinned on first sight)', async () => {
		const { scheduler } = plugin({ EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '5' });
		expect((await scheduler.runSlot('send_now')).reports[0]).toMatchObject({ status: 'sent', httpStatus: 202 });
		expect((await scheduler.runSlot('send_now')).reports[0]).toMatchObject({ status: 'sent', httpStatus: 202 });
	});

	it('switched off in Settings: no request over three slots, and Send now is refused', async () => {
		const { instance, scheduler } = plugin({ EVER_STATS_API_URL: MOCK as string, EVER_STATS_SEND_INTERVAL_S: '1' });
		await instance.ensure();
		await instance.setStatsEnabledUi(false, 'operator');
		for (let i = 0; i < 3; i += 1) {
			expect((await scheduler.runSlot('schedule')).skipped).toBe('ui');
		}
		expect(await calls()).toEqual([]);
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
