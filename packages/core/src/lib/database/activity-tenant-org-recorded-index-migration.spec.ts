import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import {
	AddActivityTenantOrgRecordedIndex1791000004600,
	ACTIVITY_TENANT_ORG_RECORDED_INDEX
} from './migrations/1791000004600-AddActivityTenantOrgRecordedIndex';

/**
 * The `(tenantId, organizationId, recordedAt)` index of `activity`, run for real on SQLite against a minimal
 * fixture of the table, and against fake Postgres / MySQL runners for the statements each dialect gets.
 */
describe('activity (tenantId, organizationId, recordedAt) index migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-activity-index-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "activity" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "recordedAt" datetime, "title" varchar)'
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const indexColumns = async (): Promise<string[] | undefined> => {
		const indexes = (await dataSource.query('PRAGMA index_list(activity)')) as Array<{ name: string }>;
		if (!indexes.some((it) => it.name === ACTIVITY_TENANT_ORG_RECORDED_INDEX)) {
			return undefined;
		}
		const columns = (await dataSource.query(
			`PRAGMA index_info(${ACTIVITY_TENANT_ORG_RECORDED_INDEX})`
		)) as Array<{ seqno: number; name: string }>;
		return columns.sort((a, b) => a.seqno - b.seqno).map((it) => it.name);
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddActivityTenantOrgRecordedIndex1791000004600()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the index on (tenantId, organizationId, recordedAt), in that order', async () => {
		await run('up');

		expect(await indexColumns()).toEqual(['tenantId', 'organizationId', 'recordedAt']);
	});

	it('is a no-op when run twice, and drops the index on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await indexColumns()).toBeUndefined();
	});

	it('runs outside a transaction, as a concurrent Postgres build needs', () => {
		expect(new AddActivityTenantOrgRecordedIndex1791000004600().transaction).toBe(false);
	});
});

describe('activity (tenantId, organizationId, recordedAt) index migration on Postgres', () => {
	const runner = (existing: Array<{ valid: boolean }>) => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			hasTable: async () => true,
			query: async (sql: string) => {
				queries.push(sql.replace(/\s+/g, ' ').trim());
				return sql.includes('pg_index') ? existing : [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	};

	it('builds the index CONCURRENTLY when it is missing', async () => {
		const { queries, queryRunner } = runner([]);

		await new AddActivityTenantOrgRecordedIndex1791000004600().up(queryRunner);

		expect(queries).toHaveLength(2);
		expect(queries[1]).toBe(
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}" ON "activity" ("tenantId", "organizationId", "recordedAt")`
		);
	});

	it('leaves a valid index alone', async () => {
		const { queries, queryRunner } = runner([{ valid: true }]);

		await new AddActivityTenantOrgRecordedIndex1791000004600().up(queryRunner);

		expect(queries).toHaveLength(1);
	});

	it('drops and rebuilds an index an interrupted concurrent build left invalid', async () => {
		const { queries, queryRunner } = runner([{ valid: false }]);

		await new AddActivityTenantOrgRecordedIndex1791000004600().up(queryRunner);

		expect(queries.slice(1)).toEqual([
			`DROP INDEX CONCURRENTLY IF EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}"`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}" ON "activity" ("tenantId", "organizationId", "recordedAt")`
		]);
	});

	it('leaves CONCURRENTLY out inside a transaction block, as a rollback runs it', async () => {
		const { queries, queryRunner } = runner([]);
		(queryRunner as unknown as { isTransactionActive: boolean }).isTransactionActive = true;
		const migration = new AddActivityTenantOrgRecordedIndex1791000004600();

		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect(queries.slice(1)).toEqual([
			`CREATE INDEX IF NOT EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}" ON "activity" ("tenantId", "organizationId", "recordedAt")`,
			`DROP INDEX IF EXISTS "${ACTIVITY_TENANT_ORG_RECORDED_INDEX}"`
		]);
	});
});

describe('activity (tenantId, organizationId, recordedAt) index migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds the index only when it is missing', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			query: async (sql: string) => {
				queries.push(sql.replace(/\s+/g, ' ').trim());
				if (sql.includes('GET_LOCK')) {
					return [{ acquired: 1 }];
				}
				return [];
			}
		} as unknown as QueryRunner;
		const migration = new AddActivityTenantOrgRecordedIndex1791000004600();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
			`CREATE INDEX \`${ACTIVITY_TENANT_ORG_RECORDED_INDEX}\` ON \`activity\` (\`tenantId\`, \`organizationId\`, \`recordedAt\`)`,
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
