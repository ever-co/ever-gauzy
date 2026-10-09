import { DataSource } from 'typeorm';
import { AddInvoiceTaxCalculationType1790000022000 } from './migrations/1790000022000-AddInvoiceTaxCalculationType';

/**
 * `invoice.taxCalculationType` — the SQLite branch, against a real better-sqlite3 database (the one
 * engine that needs no external service, as in `invoice-number-unique-migration.spec.ts`). Adding a
 * column does not depend on the rest of the table, so the fixture `invoice` table carries only the
 * columns this asserts on.
 */
describe('AddInvoiceTaxCalculationType1790000022000 (SQLite)', () => {
	let dataSource: DataSource;
	const migration = new AddInvoiceTaxCalculationType1790000022000();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		await dataSource.query(`CREATE TABLE "invoice" ("id" varchar PRIMARY KEY NOT NULL, "tax2Type" varchar)`);
		await dataSource.query(`INSERT INTO "invoice" ("id", "tax2Type") VALUES ('existing', 'PERCENT')`);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	async function column(): Promise<{ name: string; type: string; notnull: number; dflt_value: unknown } | undefined> {
		const columns = await dataSource.query(`PRAGMA table_info("invoice")`);
		return columns.find((it: { name: string }) => it.name === 'taxCalculationType');
	}

	async function run(direction: 'up' | 'down'): Promise<void> {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	}

	it('adds a nullable column with no default, so existing invoices read NULL (SIMPLE)', async () => {
		expect(await column()).toBeUndefined();

		await run('up');

		expect(await column()).toEqual(expect.objectContaining({ type: 'varchar', notnull: 0, dflt_value: null }));
		const [existing] = await dataSource.query(`SELECT "taxCalculationType" FROM "invoice" WHERE "id" = 'existing'`);
		expect(existing.taxCalculationType).toBeNull();
	});

	it('stores a value once added', async () => {
		await run('up');

		await dataSource.query(`UPDATE "invoice" SET "taxCalculationType" = 'COMPOSED' WHERE "id" = 'existing'`);

		const [row] = await dataSource.query(`SELECT "taxCalculationType" FROM "invoice" WHERE "id" = 'existing'`);
		expect(row.taxCalculationType).toBe('COMPOSED');
	});

	it('can run up twice (two processes booting against one database)', async () => {
		await run('up');

		await expect(run('up')).resolves.toBeUndefined();
		expect(await column()).toBeDefined();
	});

	it('drops the column on down, and down twice is harmless', async () => {
		await run('up');

		await run('down');
		expect(await column()).toBeUndefined();

		await expect(run('down')).resolves.toBeUndefined();
		const [existing] = await dataSource.query(`SELECT "tax2Type" FROM "invoice" WHERE "id" = 'existing'`);
		expect(existing.tax2Type).toBe('PERCENT');
	});
});
