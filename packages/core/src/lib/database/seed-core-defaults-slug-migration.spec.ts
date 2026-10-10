import { DataSource } from 'typeorm';
import { SeedCoreDefaults1791000000520 } from './migrations/1791000000520-SeedCoreDefaults';

/**
 * `SeedCoreDefaults1791000000520`'s slug backfill against a real better-sqlite3 database, with the unique
 * indexes `1791000000095` creates in place.
 *
 * The backfill used to be one statement, `UPDATE "product" SET "slug" = LOWER("code") WHERE "slug" IS NULL`,
 * under a unique index on `(organizationId, slug)` among live rows — and `product.code` is not unique: the demo
 * seed draws one word per product, so an organization's codes repeat. The first duplicate violated the index,
 * the migration aborted and the API did not boot on a database holding products. The same held for category
 * slugs derived from names. Every other step of the migration skips itself here, because its tables are not
 * in the fixture; the fixture holds only the columns the backfill reads and the indexes it has to respect.
 */
const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';

describe('SeedCoreDefaults1791000000520 — the slug backfill (SQLite)', () => {
	let dataSource: DataSource;
	const migration = new SeedCoreDefaults1791000000520();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		await dataSource.query(
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "currency" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "product" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar, "code" varchar, "slug" varchar(255), "status" varchar(16), "createdAt" datetime NOT NULL, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "product_category" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar, "slug" varchar(255), "createdAt" datetime NOT NULL, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "product_category_translation" ("id" varchar PRIMARY KEY NOT NULL, "productCategoryId" varchar, "name" varchar)`
		);
		// The SQLite bodies of `UQ_product_org_slug` and `UQ_product_category_org_slug` (1791000000095).
		for (const table of ['product', 'product_category']) {
			await dataSource.query(
				`CREATE UNIQUE INDEX "UQ_${table}_org_slug" ON "${table}" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "slug") WHERE "slug" IS NOT NULL AND "deletedAt" IS NULL`
			);
		}
		await dataSource.query(
			`INSERT INTO "organization" ("id", "tenantId", "currency") VALUES ('${ORG}', 't', 'USD'), ('${OTHER_ORG}', 't', 'USD')`
		);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	async function run(direction: 'up' | 'down'): Promise<void> {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	}

	async function product(
		id: string,
		code: string | null,
		createdAt: string,
		extra: { organizationId?: string | null; slug?: string | null; deletedAt?: string | null } = {}
	): Promise<void> {
		await dataSource.query(
			`INSERT INTO "product" ("id", "organizationId", "code", "slug", "createdAt", "deletedAt") VALUES (?, ?, ?, ?, ?, ?)`,
			[id, extra.organizationId === undefined ? ORG : extra.organizationId, code, extra.slug ?? null, createdAt, extra.deletedAt ?? null]
		);
	}

	async function slugs(table = 'product'): Promise<Record<string, string | null>> {
		const rows: Array<{ id: string; slug: string | null }> = await dataSource.query(
			`SELECT "id", "slug" FROM "${table}" ORDER BY "id"`
		);
		return Object.fromEntries(rows.map((row) => [row.id, row.slug]));
	}

	it('CONTROL: the single statement it replaced violates the index on duplicate codes', async () => {
		await product('aaaaaaaa-0000-4000-8000-000000000001', 'Lorem', '2026-01-01');
		await product('aaaaaaaa-0000-4000-8000-000000000002', 'lorem', '2026-01-02');

		await expect(
			dataSource.query(`UPDATE "product" SET "slug" = LOWER("code") WHERE "slug" IS NULL AND "deletedAt" IS NULL`)
		).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('gives duplicate codes distinct slugs, the oldest row keeping the plain one, and survives up → down → up', async () => {
		await product('aaaaaaaa-0000-4000-8000-000000000003', 'Lorem', '2026-01-03');
		await product('aaaaaaaa-0000-4000-8000-000000000001', 'Lorem', '2026-01-01');
		await product('aaaaaaaa-0000-4000-8000-000000000002', 'LOREM', '2026-01-02');
		// The same code in another organization is not a collision.
		await product('bbbbbbbb-0000-4000-8000-000000000001', 'lorem', '2026-01-04', { organizationId: OTHER_ORG });
		// A slug an administrator chose is kept, and reserved.
		await product('cccccccc-0000-4000-8000-000000000001', 'ipsum', '2026-01-05', { slug: 'dolor' });
		await product('cccccccc-0000-4000-8000-000000000002', 'Dolor', '2026-01-06');
		// No code, nothing to derive; a soft-deleted row is not written.
		await product('dddddddd-0000-4000-8000-000000000001', null, '2026-01-07');
		await product('dddddddd-0000-4000-8000-000000000002', 'lorem', '2026-01-08', { deletedAt: '2026-02-01' });

		await run('up');
		const first = await slugs();

		expect(first).toEqual({
			'aaaaaaaa-0000-4000-8000-000000000001': 'lorem',
			'aaaaaaaa-0000-4000-8000-000000000002': 'lorem-aaaaaaaa',
			// The eight-digit suffix is taken by the row above, so this one carries its whole id.
			'aaaaaaaa-0000-4000-8000-000000000003': 'lorem-aaaaaaaa-0000-4000-8000-000000000003',
			'bbbbbbbb-0000-4000-8000-000000000001': 'lorem',
			'cccccccc-0000-4000-8000-000000000001': 'dolor',
			'cccccccc-0000-4000-8000-000000000002': 'dolor-cccccccc',
			'dddddddd-0000-4000-8000-000000000001': null,
			'dddddddd-0000-4000-8000-000000000002': null
		});

		await run('down');
		await run('up');

		expect(await slugs()).toEqual(first);
	});

	it('backfills a product added after a first run without disturbing the slugs already written', async () => {
		await product('aaaaaaaa-0000-4000-8000-000000000001', 'lorem', '2026-01-01');
		await run('up');

		await product('eeeeeeee-0000-4000-8000-000000000001', 'Lorem', '2026-03-01');
		await run('up');

		expect(await slugs()).toEqual({
			'aaaaaaaa-0000-4000-8000-000000000001': 'lorem',
			'eeeeeeee-0000-4000-8000-000000000001': 'lorem-eeeeeeee'
		});
	});

	it('gives categories that share a name distinct slugs, derived from their first translation', async () => {
		await dataSource.query(
			`INSERT INTO "product_category" ("id", "organizationId", "createdAt") VALUES
			('aaaaaaaa-1111-4000-8000-000000000001', '${ORG}', '2026-01-01'),
			('aaaaaaaa-1111-4000-8000-000000000002', '${ORG}', '2026-01-02'),
			('aaaaaaaa-1111-4000-8000-000000000003', '${ORG}', '2026-01-03')`
		);
		await dataSource.query(
			`INSERT INTO "product_category_translation" ("id", "productCategoryId", "name") VALUES
			('t1', 'aaaaaaaa-1111-4000-8000-000000000001', 'Home Office'),
			('t2', 'aaaaaaaa-1111-4000-8000-000000000002', 'home office'),
			('t3', 'aaaaaaaa-1111-4000-8000-000000000002', 'Bureau'),
			('t4', 'aaaaaaaa-1111-4000-8000-000000000003', 'Garden')`
		);

		await run('up');

		expect(await slugs('product_category')).toEqual({
			'aaaaaaaa-1111-4000-8000-000000000001': 'home-office',
			'aaaaaaaa-1111-4000-8000-000000000002': 'home-office-aaaaaaaa',
			'aaaaaaaa-1111-4000-8000-000000000003': 'garden'
		});
	});
});
