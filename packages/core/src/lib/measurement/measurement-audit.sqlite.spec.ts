import type * as BetterSqlite3 from 'better-sqlite3';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { MeasurementAuditConnection } from './measurement-audit.connection';
import { MeasurementAuditService } from './measurement-audit.service';
import { IUnitReference, registerUnitReferences, withdrawUnitReferences } from './unit-references';
import { UnitCategoryCode } from './measurement.constants';

/**
 * The SQLite binding, required rather than imported.
 *
 * It is a native module, and this repository reaches it the same way everywhere: the type is imported
 * and the value is required, so nothing loads a native binding at module-parse time.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sqlite: typeof import('better-sqlite3') = require('better-sqlite3');

/**
 * The audit, run against a real database rather than against a stub.
 *
 * The statements the audit builds are the whole of it, and a test that asserts on their text proves
 * only that they are the text the author expected. These cases create the kernel's two measurement
 * tables in SQLite, insert rows that break each rule, and let the audit's own statements find them —
 * so what is being proved is that the statements *run*, that the quoting survives camel-cased column
 * names, that a join through `unit_category` really compares families, and that the rules catch the
 * rows they are meant to catch. It is the difference between "the query looks right" and "the query
 * answers".
 *
 * SQLite is the dialect worth doing this on: it is the one this platform runs on for a local
 * installation and in its demo environment, and it is the dialect every foreign key in the measurement
 * set is skipped on — which makes the audit, not a constraint, the only thing watching these columns
 * there.
 */
const OWNER = 'measurement-audit-sqlite-spec';

/** The reference under test: a table of its own, with every requirement the audit can state. */
const SPEC_REFERENCE: IUnitReference = {
	table: 'spec_table',
	column: 'unitId',
	owner: OWNER,
	sameCategoryAs: 'otherUnitId',
	description: 'A spec reference in a real schema.'
};

/** The reference whose unit must be its family's reference unit. */
const REFERENCE_UNIT_REFERENCE: IUnitReference = {
	table: 'spec_table',
	column: 'referenceUnitId',
	owner: OWNER,
	referenceUnit: true,
	description: 'A spec reference that requires a reference unit.'
};

/** The reference whose family is fixed by what the column means. */
const MASS_REFERENCE: IUnitReference = {
	table: 'spec_table',
	column: 'massUnitId',
	owner: OWNER,
	category: UnitCategoryCode.MASS,
	description: 'A spec reference that must be a mass.'
};

/** @returns A SQLite database holding the kernel's measurement tables and the spec table. */
function createSchema(): BetterSqlite3.Database {
	const db = new (Sqlite as unknown as new (path: string) => BetterSqlite3.Database)(':memory:');

	db.exec(`
		CREATE TABLE "unit_category" (
			"id" varchar PRIMARY KEY NOT NULL,
			"code" varchar(32) NOT NULL,
			"deletedAt" datetime
		);
		CREATE TABLE "unit" (
			"id" varchar PRIMARY KEY NOT NULL,
			"categoryId" varchar NOT NULL,
			"isReference" boolean NOT NULL DEFAULT (0),
			"deletedAt" datetime
		);
		CREATE TABLE "spec_table" (
			"id" varchar PRIMARY KEY NOT NULL,
			"unitId" varchar,
			"otherUnitId" varchar,
			"referenceUnitId" varchar,
			"massUnitId" varchar,
			"deletedAt" datetime
		);
	`);

	db.prepare(`INSERT INTO "unit_category" ("id", "code") VALUES (?, ?)`).run('cat-mass', 'MASS');
	db.prepare(`INSERT INTO "unit_category" ("id", "code") VALUES (?, ?)`).run('cat-count', 'COUNT');
	db.prepare(`INSERT INTO "unit" ("id", "categoryId", "isReference") VALUES (?, ?, ?)`).run(
		'unit-gram',
		'cat-mass',
		1
	);
	db.prepare(`INSERT INTO "unit" ("id", "categoryId", "isReference") VALUES (?, ?, ?)`).run(
		'unit-kilogram',
		'cat-mass',
		0
	);
	db.prepare(`INSERT INTO "unit" ("id", "categoryId", "isReference") VALUES (?, ?, ?)`).run(
		'unit-piece',
		'cat-count',
		1
	);

	return db;
}

/**
 * Wraps a SQLite database as the audit's connection.
 *
 * The dialect is `better-sqlite3`, which is the spelling this platform passes to TypeORM, so the
 * connection's own dialect resolution and quoting are the ones under test and not a stand-in.
 *
 * @param db The database.
 * @returns The connection.
 */
function connectionOver(db: BetterSqlite3.Database): MeasurementAuditConnection {
	const dataSource = {
		options: { type: 'better-sqlite3' },
		async query(sql: string): Promise<unknown> {
			return db.prepare(sql).all();
		},
		createQueryRunner() {
			return {
				async hasTable(table: string): Promise<boolean> {
					return Boolean(
						db
							.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
							.get(table)
					);
				},
				async hasColumn(table: string, column: string): Promise<boolean> {
					const columns = db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Array<{
						name: string;
					}>;

					return columns.some((entry) => entry.name === column);
				},
				async release(): Promise<void> {
					// The database outlives the query runner, which is what makes this a stub.
				}
			};
		}
	};

	return new MeasurementAuditConnection(dataSource as never, undefined);
}

describe('the measurement audit over a real SQLite schema', () => {
	let db: BetterSqlite3.Database;

	beforeEach(() => {
		db = createSchema();
		registerUnitReferences([SPEC_REFERENCE, REFERENCE_UNIT_REFERENCE, MASS_REFERENCE]);
	});

	afterEach(() => {
		withdrawUnitReferences(OWNER);
		db.close();
	});

	it('runs every statement it builds', async () => {
		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.unchecked).toEqual([]);
		expect(report.findings).toEqual([]);
		// Three references, each stating one or two rules besides the dangling one.
		expect(report.checked).toBe(6);
		expect(report.clean).toBe(true);
	});

	it('accepts a row whose references are all sound', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-ok', 'unit-kilogram', 'unit-gram', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toEqual([]);
		expect(report.clean).toBe(true);
	});

	it('finds a row naming a unit that does not exist', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-dangling', 'unit-gone', 'unit-gram', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			table: 'spec_table',
			column: 'unitId',
			rule: ApiErrorCode.UNIT_REFERENCE_DANGLING,
			violations: 1
		});
	});

	it('counts every dangling row rather than reporting the first', async () => {
		const insert = db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		);

		insert.run('row-1', 'unit-gone', 'unit-gram', 'unit-gram', 'unit-gram');
		insert.run('row-2', 'unit-also-gone', 'unit-gram', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();
		const dangling = report.findings.filter((finding) => finding.rule === ApiErrorCode.UNIT_REFERENCE_DANGLING);

		expect(dangling).toHaveLength(1);
		expect(dangling[0].violations).toBe(2);
		expect(report.totalViolations).toBe(2);
	});

	it('finds two units of different families used on one row', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-mixed', 'unit-kilogram', 'unit-piece', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();
		const mismatch = report.findings.filter(
			(finding) => finding.rule === ApiErrorCode.UNIT_CATEGORY_MISMATCH && finding.column === 'unitId'
		);

		expect(mismatch).toHaveLength(1);
		expect(mismatch[0].violations).toBe(1);
	});

	it('says nothing about two units of the same family', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-mass', 'unit-kilogram', 'unit-gram', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toEqual([]);
	});

	it('finds a column stated in a family its meaning forbids', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-wrong-family', 'unit-gram', 'unit-gram', 'unit-gram', 'unit-piece');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			column: 'massUnitId',
			rule: ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			violations: 1
		});
	});

	it('finds a stock unit that is not its family reference', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId") VALUES (?, ?, ?, ?, ?)`
		).run('row-not-reference', 'unit-gram', 'unit-gram', 'unit-kilogram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			column: 'referenceUnitId',
			rule: ApiErrorCode.STOCK_UNIT_NOT_REFERENCE,
			violations: 1
		});
	});

	it('leaves a null reference alone, because a column nobody filled in is another report', async () => {
		db.prepare(`INSERT INTO "spec_table" ("id") VALUES (?)`).run('row-empty');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toEqual([]);
		expect(report.clean).toBe(true);
	});

	it('leaves a soft-deleted row out of the count', async () => {
		db.prepare(
			`INSERT INTO "spec_table" ("id", "unitId", "otherUnitId", "referenceUnitId", "massUnitId", "deletedAt") VALUES (?, ?, ?, ?, ?, datetime('now'))`
		).run('row-deleted', 'unit-gone', 'unit-gram', 'unit-gram', 'unit-gram');

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toEqual([]);
	});

	it('reports a reference whose table is not in this installation as skipped', async () => {
		registerUnitReferences([
			{ table: 'absent_table', column: 'unitId', owner: OWNER, description: 'Not installed here.' }
		]);

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.unchecked).toEqual([]);
		expect(report.findings).toEqual([]);
		// Five, not one: the kernel's own four product-variant references are skipped on this schema
		// too, because it declares no `product_variant`. That is the answer an installation which has
		// not installed such a table should get — neither a finding nor a refusal to look.
		expect(report.skipped).toBe(5);
		// The three spec references' four rules, each counted with its dangling rule.
		expect(report.checked).toBe(6);
	});

	it('reports a reference whose column is missing as skipped rather than as unchecked', async () => {
		registerUnitReferences([
			{ table: 'spec_table', column: 'notAColumn', owner: OWNER, description: 'Not in this schema.' }
		]);

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.skipped).toBe(5);
		expect(report.unchecked).toEqual([]);
		expect(report.checked).toBe(6);
	});

	it('checks a kernel reference once its table is there', async () => {
		db.exec(`CREATE TABLE "product_variant" ("id" varchar PRIMARY KEY NOT NULL, "stockUnitId" varchar)`);

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.unchecked).toEqual([]);
		// The stock unit column is now audited rather than skipped, and the variant that names a unit
		// which does not exist is found — by the kernel's own declaration, with no plugin involved.
		expect(report.findings.some((finding) => finding.owner === 'core')).toBe(false);

		db.prepare(`INSERT INTO "product_variant" ("id", "stockUnitId") VALUES (?, ?)`).run(
			'variant-dangling',
			'unit-gone'
		);

		const dirty = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(dirty.findings).toHaveLength(1);
		expect(dirty.findings[0]).toMatchObject({
			table: 'product_variant',
			column: 'stockUnitId',
			owner: 'core',
			rule: ApiErrorCode.UNIT_REFERENCE_DANGLING,
			violations: 1
		});
	});

	it('finds a kernel variant stocked in a unit that is not its family reference', async () => {
		db.exec(
			`CREATE TABLE "product_variant" ("id" varchar PRIMARY KEY NOT NULL, "stockUnitId" varchar, "salesUnitId" varchar)`
		);
		db.prepare(`INSERT INTO "product_variant" ("id", "stockUnitId", "salesUnitId") VALUES (?, ?, ?)`).run(
			'variant-not-reference',
			'unit-kilogram',
			'unit-kilogram'
		);

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			column: 'stockUnitId',
			rule: ApiErrorCode.STOCK_UNIT_NOT_REFERENCE,
			violations: 1
		});
	});

	it('finds a kernel variant sold in a different family from the one it is stocked in', async () => {
		db.exec(
			`CREATE TABLE "product_variant" ("id" varchar PRIMARY KEY NOT NULL, "stockUnitId" varchar, "salesUnitId" varchar)`
		);
		db.prepare(`INSERT INTO "product_variant" ("id", "stockUnitId", "salesUnitId") VALUES (?, ?, ?)`).run(
			'variant-crossed',
			'unit-gram',
			'unit-piece'
		);

		const report = await new MeasurementAuditService(connectionOver(db)).audit();

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			column: 'salesUnitId',
			rule: ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			violations: 1
		});
	});
});
