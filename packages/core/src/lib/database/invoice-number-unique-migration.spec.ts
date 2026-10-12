// cspell:ignore clob dflt
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AlterInvoiceNumberUniquePerTenant1790000015400 } from './migrations/1790000015400-AlterInvoiceNumberUniquePerTenant';

/**
 * GHSA-57hw-jqpj-ww97: `invoice.invoiceNumber` was unique across the whole installation, so tenants
 * shared one number sequence. The migration makes it UNIQUE(tenantId, invoiceNumber).
 *
 * Only the SQLite branch is exercised here — it is the one engine of the three that needs no
 * external service (same scope as `migration-smoke.spec.ts`) and also the only one whose branch is
 * more than two statements, since SQLite cannot drop an inline constraint and must rebuild the
 * table. The Postgres and MySQL branches are covered by the reviewer checklist, not by this spec.
 *
 * The starting schema is not hand-written: it is the `invoice` DDL the real migration chain leaves
 * behind (the last SQLite rebuild of the table, in the `deletedByUserId` migration), read from that
 * migration's source. A hand-copied DDL would drift from the chain and quietly stop testing the
 * shape that production actually has.
 */
const LAST_SQLITE_INVOICE_MIGRATION = '1740811220961-AlterBaseEntityAddDeletedByUserIdColumn.ts';

/** The `invoice` CREATE TABLE and its indexes exactly as the migration chain leaves them. */
function currentSqliteInvoiceSchema(): { table: string; indexes: string[] } {
	const source = fs.readFileSync(path.join(__dirname, 'migrations', LAST_SQLITE_INVOICE_MIGRATION), 'utf8');
	const up = source.slice(
		source.indexOf('public async sqliteUpQueryRunner'),
		source.indexOf('public async sqliteDownQueryRunner')
	);

	const tables = up.match(/CREATE TABLE "temporary_invoice" \([^`]*\)/g) ?? [];
	const table = tables[tables.length - 1].replace('"temporary_invoice"', '"invoice"');
	const indexes = up.match(/CREATE INDEX "[^"]+" ON "invoice" \([^)]*\)/g) ?? [];

	return { table, indexes: [...new Set(indexes)] };
}

/** Foreign key columns of the `invoice` DDL, mapped to the table they point at. */
const foreignKeys = (tableSql: string): Map<string, string> =>
	new Map(
		[...tableSql.matchAll(/FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"/g)].map((match) => [match[1], match[2]])
	);

/** Id of the stub row each referenced table gets, so NOT NULL foreign keys have something to point at. */
const STUB_ID = '11111111-1111-4111-8111-111111111111';

const TENANT_A = '6b6c8a5e-0b0a-4e2b-9d1a-0f1f2a3b4c5d';
const TENANT_B = '9f0e1d2c-3b4a-4958-8a7b-6c5d4e3f2a1b';

/**
 * Inserts a row, filling whatever NOT NULL columns the real DDL happens to declare (currency, terms,
 * `fromOrganizationId`, ...) so the fixture does not have to track them by hand. NOT NULL foreign
 * keys get the stub row of the table they reference.
 */
async function insertInvoice(
	dataSource: DataSource,
	id: string,
	tenantId: string,
	invoiceNumber: number
): Promise<unknown> {
	const columns: Array<{ name: string; type: string; notnull: number; dflt_value: string | null }> =
		await dataSource.query(`PRAGMA table_info("invoice")`);
	const references = foreignKeys(currentSqliteInvoiceSchema().table);

	const row: Record<string, unknown> = { id, tenantId, invoiceNumber };
	for (const column of columns) {
		if (!column.notnull || column.dflt_value !== null || column.name in row) {
			continue;
		}
		if (references.has(column.name)) {
			row[column.name] = STUB_ID;
		} else {
			row[column.name] = /char|text|clob/i.test(column.type) ? 'fixture' : 0;
		}
	}

	const names = Object.keys(row);
	return dataSource.query(
		`INSERT INTO "invoice" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names
			.map(() => '?')
			.join(', ')})`,
		names.map((name) => row[name])
	);
}

describe('AlterInvoiceNumberUniquePerTenant (SQLite) — GHSA-57hw-jqpj-ww97', () => {
	let dbPath: string;
	let dataSource: DataSource;

	const invoiceTableSql = async (): Promise<string> => {
		const [row] = await dataSource.query(
			`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'invoice'`
		);
		return row.sql;
	};

	const columnNames = async (): Promise<string[]> =>
		(await dataSource.query(`PRAGMA table_info("invoice")`)).map((column: { name: string }) => column.name);

	const indexNames = async (): Promise<string[]> =>
		(
			await dataSource.query(
				`SELECT "name" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = 'invoice' AND "sql" IS NOT NULL`
			)
		).map((index: { name: string }) => index.name);

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-invoice-unique-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [AlterInvoiceNumberUniquePerTenant1790000015400],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		const { table, indexes } = currentSqliteInvoiceSchema();
		// Stubs for the tables `invoice` has foreign keys to. They are not decoration: SQLite refuses
		// the `ALTER TABLE … RENAME TO` that ends the rebuild while any referenced table is missing.
		for (const referenced of new Set(foreignKeys(table).values())) {
			await dataSource.query(`CREATE TABLE "${referenced}" ("id" varchar PRIMARY KEY NOT NULL)`);
			await dataSource.query(`INSERT INTO "${referenced}" ("id") VALUES (?)`, [STUB_ID]);
		}
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT_A, TENANT_B]);
		await dataSource.query(table);
		for (const index of indexes) {
			await dataSource.query(index);
		}
		await insertInvoice(dataSource, 'a-1', TENANT_A, 100);
		await insertInvoice(dataSource, 'b-1', TENANT_B, 5000);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('control: before the migration, one tenant cannot use a number another tenant holds', async () => {
		expect(await invoiceTableSql()).toContain(
			'CONSTRAINT "UQ_d7bed97fb47876e03fd7d7c285a" UNIQUE ("invoiceNumber")'
		);
		await expect(insertInvoice(dataSource, 'a-2', TENANT_A, 5000)).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('after the migration the same number is free in another tenant, and still taken in its own', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		await expect(insertInvoice(dataSource, 'a-2', TENANT_A, 5000)).resolves.toBeDefined();
		await expect(insertInvoice(dataSource, 'a-3', TENANT_A, 100)).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('swaps the constraint and keeps every column, index and row of the rebuilt table', async () => {
		const columnsBefore = await columnNames();
		const indexesBefore = await indexNames();

		await dataSource.runMigrations({ transaction: 'each' });

		const sql = await invoiceTableSql();
		expect(sql).toContain('CONSTRAINT "UQ_205ce780e85433a0b705baa130d" UNIQUE ("tenantId", "invoiceNumber")');
		expect(sql).not.toContain('UQ_d7bed97fb47876e03fd7d7c285a');
		expect(await columnNames()).toEqual(columnsBefore);
		expect((await indexNames()).sort()).toEqual(indexesBefore.sort());
		expect(await dataSource.query(`SELECT "id" FROM "invoice" ORDER BY "id"`)).toEqual([
			{ id: 'a-1' },
			{ id: 'b-1' }
		]);
	});

	it('reverts to the installation-wide constraint while no number is shared by two tenants', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		await dataSource.undoLastMigration({ transaction: 'each' });

		expect(await invoiceTableSql()).toContain(
			'CONSTRAINT "UQ_d7bed97fb47876e03fd7d7c285a" UNIQUE ("invoiceNumber")'
		);
		await expect(insertInvoice(dataSource, 'a-2', TENANT_A, 5000)).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('refuses to revert once two tenants share a number, instead of failing halfway', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		await insertInvoice(dataSource, 'a-2', TENANT_A, 5000);

		await expect(dataSource.undoLastMigration({ transaction: 'each' })).rejects.toThrow(
			/used by more than one tenant: 5000/
		);
		// The refusal leaves the tenant-local constraint in place.
		expect(await invoiceTableSql()).toContain('CONSTRAINT "UQ_205ce780e85433a0b705baa130d" UNIQUE');
	});
});

/**
 * The MySQL branch, driven against a stub query runner.
 *
 * MySQL commits each DDL statement on its own, so `migrationsTransactionMode: 'each'` cannot roll the
 * CREATE and the DROP back together: a crash between them used to leave the composite index behind
 * with the migration unrecorded, and the retry on the next boot died on `Duplicate key name`. No MySQL
 * server is available here, so the unique indexes are simulated: the migration only learns about them
 * through `information_schema.STATISTICS`, which is exactly what this stub answers.
 */
describe('AlterInvoiceNumberUniquePerTenant (MySQL) — recovery after a partial run', () => {
	/** A stub runner over a set of unique indexes, recording the DDL the migration issues. */
	const mysqlRunner = (indexes: Record<string, string[]>) => {
		const statements: string[] = [];
		const runner = {
			connection: { options: { type: 'mysql' } },
			query: async (sql: string, parameters?: unknown[]) => {
				if (sql.includes('information_schema')) {
					const columns = String(parameters?.[0]);
					return Object.entries(indexes)
						.filter(([, indexColumns]) => indexColumns.join(',') === columns)
						.map(([indexName]) => ({ indexName }));
				}
				if (!/^(CREATE|DROP) /.test(sql)) {
					return []; // the duplicate-number lookup `down()` runs first; no row is shared here
				}
				statements.push(sql);

				const created = /CREATE UNIQUE INDEX `([^`]+)` ON `invoice` \(([^)]+)\)/.exec(sql);
				if (created) {
					indexes[created[1]] = created[2].split(',').map((column) => column.trim().replace(/`/g, ''));
				}
				const dropped = /DROP INDEX `([^`]+)`/.exec(sql);
				if (dropped) {
					delete indexes[dropped[1]];
				}
				return [];
			}
		};
		return { runner: runner as any, statements, indexes };
	};

	/** The `invoice` unique indexes as the migration chain leaves them on MySQL. */
	const globalOnly = () => ({ IDX_d7bed97fb47876e03fd7d7c285: ['invoiceNumber'], PRIMARY: ['id'] });

	it('swaps the installation-wide unique index for the tenant-local one', async () => {
		const { runner, statements, indexes } = mysqlRunner(globalOnly());

		await new AlterInvoiceNumberUniquePerTenant1790000015400().up(runner);

		expect(statements).toEqual([
			'CREATE UNIQUE INDEX `IDX_205ce780e85433a0b705baa130` ON `invoice` (`tenantId`, `invoiceNumber`)',
			'DROP INDEX `IDX_d7bed97fb47876e03fd7d7c285` ON `invoice`'
		]);
		expect(indexes).toEqual({ IDX_205ce780e85433a0b705baa130: ['tenantId', 'invoiceNumber'], PRIMARY: ['id'] });
	});

	it('resumes when a previous run created the index and died before dropping the old one', async () => {
		// Exactly the state MySQL is left in when the process stops between the two DDL statements.
		const { runner, statements, indexes } = mysqlRunner({
			...globalOnly(),
			IDX_205ce780e85433a0b705baa130: ['tenantId', 'invoiceNumber']
		});

		await new AlterInvoiceNumberUniquePerTenant1790000015400().up(runner);

		// No second CREATE: that is the `Duplicate key name` which used to block every later boot.
		expect(statements).toEqual(['DROP INDEX `IDX_d7bed97fb47876e03fd7d7c285` ON `invoice`']);
		expect(indexes).toEqual({ IDX_205ce780e85433a0b705baa130: ['tenantId', 'invoiceNumber'], PRIMARY: ['id'] });
	});

	it('is a no-op on a second run once the swap is complete', async () => {
		const { runner, statements } = mysqlRunner({
			IDX_205ce780e85433a0b705baa130: ['tenantId', 'invoiceNumber'],
			PRIMARY: ['id']
		});

		await new AlterInvoiceNumberUniquePerTenant1790000015400().up(runner);

		expect(statements).toEqual([]);
	});

	it('converts an index the migration chain did not name, and leaves the primary key alone', async () => {
		// e.g. an install whose unique was created by `synchronize` under another name.
		const { runner, statements, indexes } = mysqlRunner({ invoice_number_key: ['invoiceNumber'], PRIMARY: ['id'] });

		await new AlterInvoiceNumberUniquePerTenant1790000015400().up(runner);

		expect(statements).toContain('DROP INDEX `invoice_number_key` ON `invoice`');
		expect(indexes).toEqual({ IDX_205ce780e85433a0b705baa130: ['tenantId', 'invoiceNumber'], PRIMARY: ['id'] });
	});

	it('reverting drops the tenant-local index whatever it is named', async () => {
		const { runner, statements, indexes } = mysqlRunner({
			tenant_invoice_number_key: ['tenantId', 'invoiceNumber'],
			PRIMARY: ['id']
		});

		await new AlterInvoiceNumberUniquePerTenant1790000015400().down(runner);

		expect(statements).toEqual([
			'CREATE UNIQUE INDEX `IDX_d7bed97fb47876e03fd7d7c285` ON `invoice` (`invoiceNumber`)',
			'DROP INDEX `tenant_invoice_number_key` ON `invoice`'
		]);
		expect(indexes).toEqual({ IDX_d7bed97fb47876e03fd7d7c285: ['invoiceNumber'], PRIMARY: ['id'] });
	});
});
