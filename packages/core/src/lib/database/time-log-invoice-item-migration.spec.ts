import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import {
	AddTimeLogInvoiceItem1791000008600,
	TIME_LOG_INVOICE_ITEM_FOREIGN_KEY,
	TIME_LOG_INVOICE_ITEM_INDEX
} from './migrations/1791000008600-AddTimeLogInvoiceItem';

/**
 * `time_log.invoiceItemId`, run for real on SQLite against a minimal fixture of the two tables: a nullable column that
 * every existing log starts without, indexed, whose line going away clears it.
 */
const LINE = 'a0000000-0000-4000-8000-000000000001';
const LOG = 'b0000000-0000-4000-8000-000000000001';

describe('time_log.invoiceItemId migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-time-log-invoice-item-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "invoice_item" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query('CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "description" varchar)');
		await dataSource.query(`INSERT INTO "invoice_item" ("id") VALUES (?)`, [LINE]);
		await dataSource.query(`INSERT INTO "time_log" ("id", "description") VALUES (?, 'Existing')`, [LOG]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddTimeLogInvoiceItem1791000008600()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(time_log)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
		}>;
		return columns.find((it) => it.name === 'invoiceItemId');
	};

	const indexNames = async (): Promise<string[]> => {
		const indexes = (await dataSource.query('PRAGMA index_list(time_log)')) as Array<{ name: string }>;
		return indexes.map((index) => index.name);
	};

	const invoiceItemOfLog = async (): Promise<string | null> => {
		const [log] = await dataSource.query(`SELECT "invoiceItemId" FROM "time_log" WHERE "id" = ?`, [LOG]);
		return log.invoiceItemId;
	};

	it('adds a nullable, indexed column referencing the line, which every existing log starts without', async () => {
		await run('up');

		expect(await column()).toMatchObject({ notnull: 0, dflt_value: null });
		expect(await indexNames()).toContain(TIME_LOG_INVOICE_ITEM_INDEX);
		const foreignKeys = await dataSource.query('PRAGMA foreign_key_list(time_log)');
		expect(foreignKeys).toEqual([
			expect.objectContaining({ table: 'invoice_item', from: 'invoiceItemId', to: 'id', on_delete: 'SET NULL' })
		]);
		expect(await invoiceItemOfLog()).toBeNull();
	});

	it('clears the link when the line that bills the log is deleted', async () => {
		await run('up');
		await dataSource.query(`UPDATE "time_log" SET "invoiceItemId" = ? WHERE "id" = ?`, [LINE, LOG]);

		await dataSource.query(`DELETE FROM "invoice_item" WHERE "id" = ?`, [LINE]);

		expect(await invoiceItemOfLog()).toBeNull();
	});

	it('is a no-op when run twice, drops the index on down and keeps the column, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();

		await run('down');
		expect(await indexNames()).not.toContain(TIME_LOG_INVOICE_ITEM_INDEX);
		expect(await column()).toBeDefined();

		await run('up');
		expect(await indexNames()).toContain(TIME_LOG_INVOICE_ITEM_INDEX);
	});
});

/** A query runner that records the statements it is given, answering the checks as the arguments say. */
function scriptedRunner(type: 'postgres' | 'mysql', state: { hasColumn: boolean; hasKeyAndIndex: boolean }) {
	const queries: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => true,
		hasColumn: async () => state.hasColumn,
		getTable: async () => ({
			foreignKeys: state.hasKeyAndIndex ? [{ name: TIME_LOG_INVOICE_ITEM_FOREIGN_KEY }] : [],
			indices: state.hasKeyAndIndex ? [{ name: TIME_LOG_INVOICE_ITEM_INDEX }] : []
		}),
		query: async (sql: string) => {
			queries.push(sql);
			const isLock = sql.includes('GET_LOCK');
			if (isLock) {
				return [{ acquired: 1 }];
			}
			return [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('time_log.invoiceItemId migration on Postgres', () => {
	it('serialises concurrent runs and adds the column, its index and its foreign key when they are missing', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: false, hasKeyAndIndex: false });

		await new AddTimeLogInvoiceItem1791000008600().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "time_log" ADD COLUMN IF NOT EXISTS "invoiceItemId" uuid',
			`CREATE INDEX IF NOT EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}" ON "time_log" ("invoiceItemId")`,
			`ALTER TABLE "time_log" ADD CONSTRAINT "${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		]);
	});

	it('takes no ACCESS EXCLUSIVE lock for a column created ahead of the deploy (no ALTER TABLE at all)', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true, hasKeyAndIndex: true });

		await new AddTimeLogInvoiceItem1791000008600().up(queryRunner);

		expect(queries.some((sql) => sql.startsWith('ALTER TABLE'))).toBe(false);
		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			`CREATE INDEX IF NOT EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}" ON "time_log" ("invoiceItemId")`
		]);
	});

	it('drops the foreign key, the index and the column on down', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true, hasKeyAndIndex: true });

		await new AddTimeLogInvoiceItem1791000008600().down(queryRunner);

		expect(queries).toEqual([
			`ALTER TABLE "time_log" DROP CONSTRAINT IF EXISTS "${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}"`,
			`DROP INDEX IF EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}"`,
			'ALTER TABLE "time_log" DROP COLUMN IF EXISTS "invoiceItemId"'
		]);
	});
});

describe('time_log.invoiceItemId migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds the column, then its index, then its foreign key', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: false, hasKeyAndIndex: false });
		const migration = new AddTimeLogInvoiceItem1791000008600();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `time_log` ADD COLUMN `invoiceItemId` varchar(255) NULL',
			`CREATE INDEX \`${TIME_LOG_INVOICE_ITEM_INDEX}\` ON \`time_log\` (\`invoiceItemId\`)`,
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}\` FOREIGN KEY (\`invoiceItemId\`) REFERENCES \`invoice_item\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('writes nothing when everything is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true, hasKeyAndIndex: true });

		await new AddTimeLogInvoiceItem1791000008600().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});

	it('drops the foreign key before the index it needs, then the column, on down', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true, hasKeyAndIndex: true });

		await new AddTimeLogInvoiceItem1791000008600().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}\``,
			`DROP INDEX \`${TIME_LOG_INVOICE_ITEM_INDEX}\` ON \`time_log\``,
			'ALTER TABLE `time_log` DROP COLUMN `invoiceItemId`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
