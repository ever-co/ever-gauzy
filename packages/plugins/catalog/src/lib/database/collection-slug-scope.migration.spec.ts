import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, MigrationInterface } from 'typeorm';

/**
 * R5-06: the uniqueness of a collection's slug, against the catalog's own migrations run on a real
 * better-sqlite3 database.
 *
 * A collection is either a **merchandising collection** (no `customerId`), whose slug is unique within its
 * organization, or a buyer's **saved list** (`customerId` set), whose slug is unique for that buyer
 * (`UQ_collection_customer_slug`). `CollectionService.assertSlugIsAvailable` checks exactly that. But
 * `1791000000100` created `UQ_collection_org_slug` over `(organization, slug)` for every live row, saved
 * lists included, so the second buyer of an organization to save a list called `favorites` — or a buyer
 * whose list shares a slug with a merchandising collection — passed the service's check and was then
 * refused by the database.
 *
 * Every migration in `./migrations` runs, in timestamp order, the way the plugin registers them; the
 * last case pins that the plugin does register every one of them.
 */

const ORG = '5e1f0000-0000-4000-8000-0000000000a1';
const TENANT = '5e1f0000-0000-4000-8000-0000000000f1';
const BUYER_A = '5e1f0000-0000-4000-8000-0000000000b1';
const BUYER_B = '5e1f0000-0000-4000-8000-0000000000b2';

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const MIGRATION_FILE = /^\d{13}-[A-Za-z0-9]+\.ts$/;

/** The catalog's migrations, in the order TypeORM runs them. */
function catalogMigrations(): MigrationInterface[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((file) => MIGRATION_FILE.test(file))
		.sort()
		.map((file) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const exported = require(join(MIGRATIONS_DIR, file));
			const Migration = Object.values(exported).find((value) => typeof value === 'function') as new () => MigrationInterface;
			return new Migration();
		});
}

describe('collection slugs — merchandising collections per organization, saved lists per buyer (SQLite)', () => {
	let dataSource: DataSource;
	let sequence = 0;

	async function migrate(direction: 'up' | 'down', migrations: MigrationInterface[]): Promise<void> {
		const queryRunner = dataSource.createQueryRunner();
		try {
			for (const migration of migrations) {
				await migration[direction](queryRunner);
			}
		} finally {
			await queryRunner.release();
		}
	}

	/** Inserts a live collection row; a saved list when `customerId` is given. */
	async function insertCollection(
		slug: string,
		options: { customerId?: string; organizationId?: string | null; deletedAt?: string } = {}
	): Promise<void> {
		await dataSource.query(
			`INSERT INTO "collection" ("id", "tenantId", "organizationId", "name", "slug", "customerId", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				`5e1f0000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
				TENANT,
				options.organizationId === undefined ? ORG : options.organizationId,
				slug,
				slug,
				options.customerId ?? null,
				options.deletedAt ?? null
			]
		);
	}

	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		// The catalog's tables reference core tables (organization_contact, product, image_asset, …) that are
		// not part of this fixture; the rule under test is a unique index, not a foreign key.
		await dataSource.query(`PRAGMA foreign_keys = OFF`);
		await migrate('up', catalogMigrations());
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	it('lets two buyers of one organization each keep a saved list with the same slug', async () => {
		await insertCollection('favorites', { customerId: BUYER_A });
		await insertCollection('favorites', { customerId: BUYER_B });

		await expect(dataSource.query(`SELECT COUNT(*) AS "n" FROM "collection"`)).resolves.toEqual([{ n: 2 }]);
	});

	it('lets a saved list share its slug with a merchandising collection of the organization', async () => {
		await insertCollection('summer');
		await insertCollection('summer', { customerId: BUYER_A });

		await expect(dataSource.query(`SELECT COUNT(*) AS "n" FROM "collection"`)).resolves.toEqual([{ n: 2 }]);
	});

	it('still refuses two live merchandising collections with one slug in one organization', async () => {
		await insertCollection('summer');

		await expect(insertCollection('summer')).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('still treats every organization-less merchandising collection as one scope', async () => {
		await insertCollection('summer', { organizationId: null });

		await expect(insertCollection('summer', { organizationId: null })).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('still refuses one buyer two saved lists with one slug', async () => {
		await insertCollection('favorites', { customerId: BUYER_A });

		await expect(insertCollection('favorites', { customerId: BUYER_A })).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('still lets a deleted merchandising collection’s slug be used again', async () => {
		await insertCollection('summer', { deletedAt: '2026-01-01 00:00:00' });
		await insertCollection('summer');

		await expect(dataSource.query(`SELECT COUNT(*) AS "n" FROM "collection"`)).resolves.toEqual([{ n: 2 }]);
	});

	it('restores the organization-wide index on the way down', async () => {
		const migrations = catalogMigrations();
		await migrate('down', migrations.slice(1).reverse());

		await insertCollection('favorites', { customerId: BUYER_A });
		await expect(insertCollection('favorites', { customerId: BUYER_B })).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('is registered with the plugin: every migration in the directory is in `migrations`', () => {
		const plugin = readFileSync(join(__dirname, '..', 'catalog.plugin.ts'), 'utf8');
		const registered = /migrations:\s*\[([^\]]*)\]/.exec(plugin)?.[1] ?? '';

		for (const migration of catalogMigrations()) {
			expect({ migration: migration.constructor.name, registered: registered.includes(migration.constructor.name) }).toEqual({
				migration: migration.constructor.name,
				registered: true
			});
		}
	});
});
