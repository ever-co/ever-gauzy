import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, statsPeriod } from './ever-stats-collector.service';
import { CANARY_GOLDEN, CANARY_NOW, CanarySeed, canaryLeaks, seedCanaryDatabase } from './fixtures/canary-seed';
import { CORE_TABLES, createCoreTables, dropTables, insert, openTestDataSource, PLUGIN_TABLES, TEST_TARGETS } from './fixtures/test-db';

const SEPTEMBER = statsPeriod(new Date(Date.UTC(2026, 8, 15)));
const FEATURES = { FEATURE_INVOICE: true, FEATURE_JOB: false, FEATURE_OPEN_STATS: false, FEATURE_SOMETHING_NEW: true };

// Creating and dropping tables on a real Postgres or MySQL takes longer than the default 5 s.
jest.setTimeout(120_000);

/**
 * The collector itself, with nothing swapped in: the counters, the monthly totals and the canary run
 * the code the API runs, on SQLite and (in CI) Postgres.
 */
describe.each(TEST_TARGETS)('EverStatsCollector on $name', (target) => {
	let dataSource: DataSource;
	let seed: CanarySeed;
	const d = target.name;

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		seed = await seedCanaryDatabase(dataSource, d);
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	const collector = () => new EverStatsCollector(dataSource, FEATURES);

	it('counts instance-wide, per currency in minor units, for the UTC month only (golden)', async () => {
		const collected = await collector().collect(SEPTEMBER, CANARY_NOW);
		expect(collected).toEqual({ ...CANARY_GOLDEN, features: { invoice: true, job: false, open_stats: false } });
	});

	it('counts users active in the 30 days before the collection', async () => {
		expect((await collector().collect(SEPTEMBER, new Date(Date.UTC(2026, 9, 12)))).counts['users_active_30d']).toBe(0);
		expect((await collector().collect(SEPTEMBER, new Date(Date.UTC(2026, 6, 15)))).counts['users_active_30d']).toBe(3);
	});

	it('builds a report from them that carries none of the names, addresses, numbers or texts of the database (canary)', async () => {
		const collected = await collector().collect(SEPTEMBER, CANARY_NOW);
		const built = new EverStatsBuilder().build({
			identity: { instanceId: randomUUID() },
			config: { country: 'ZZ', serves: ['gauzy'], installSource: 'self-hosted' },
			release: parseReleaseVersion('v111.47.0'),
			period: SEPTEMBER,
			final: false,
			collected,
			now: new Date(Date.UTC(2026, 8, 20))
		});
		expect(built.ok).toBe(true);
		if (!built.built) return;
		expect(seed.seeded.length).toBeGreaterThan(20);
		expect(canaryLeaks(seed.seeded, built.built.text)).toEqual([]);
		// Control: the same check finds one seeded e-mail address planted in a copy of the report.
		const planted = built.built.text.replace('"ZZ"', JSON.stringify(seed.seeded.find((s) => s.includes('@'))));
		expect(canaryLeaks(seed.seeded, planted)).toHaveLength(1);
	});

	it('reports a one-user installation in full (no small-instance suppression)', async () => {
		const small = await openTestDataSource({ name: 'better-sqlite3' });
		try {
			await createCoreTables(small, 'better-sqlite3');
			const tenantId = randomUUID();
			await insert(small, 'better-sqlite3', 'tenant', { id: tenantId, name: 'Solo' });
			await insert(small, 'better-sqlite3', 'user', { id: randomUUID(), tenantId, email: 'solo@solo.example', isActive: true });
			await insert(small, 'better-sqlite3', 'invoice', { id: randomUUID(), tenantId, invoiceNumber: '1', currency: 'EUR', totalValue: 12.34, isEstimate: false, invoiceDate: '2026-09-02 10:00:00' });
			const collected = await new EverStatsCollector(small, {}).collect(SEPTEMBER, CANARY_NOW);
			expect(collected.counts).toMatchObject({ tenants: 1, users: 1 });
			expect(collected.aggregates).toMatchObject({ invoiced_minor: { EUR: 1234 }, invoices: 1 });
		} finally {
			await small.destroy();
		}
	});

	if (target.name === 'postgres') {
		it('runs under a statement timeout on Postgres: a slow query is stopped by the database', async () => {
			const t = (name: string) => `"${name}"`;
			await dataSource.query(`ALTER TABLE ${t('task')} RENAME TO ${t('task_saved')}`);
			try {
				await dataSource.query(`CREATE VIEW ${t('task')} AS SELECT NULL::timestamp AS ${t('deletedAt')} FROM pg_sleep(2)`);
				const slow = new EverStatsCollector(dataSource, FEATURES, 100);
				await expect(slow.collect(SEPTEMBER, CANARY_NOW)).rejects.toThrow(/statement timeout/);
			} finally {
				await dataSource.query(`DROP VIEW IF EXISTS ${t('task')}`);
				await dataSource.query(`ALTER TABLE ${t('task_saved')} RENAME TO ${t('task')}`);
			}
			expect((await collector().collect(SEPTEMBER, CANARY_NOW)).counts['tasks']).toBe(5);
		});
	}
});
