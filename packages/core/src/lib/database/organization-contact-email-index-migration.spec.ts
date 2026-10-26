import { DataSource } from 'typeorm';
import { AlterCoreTablesForExtensions1791000000095 } from './migrations/1791000000095-AlterCoreTablesForExtensions';

/**
 * `organization_contact.emailKey` is indexed for lookup and not constrained, on a real better-sqlite3
 * database.
 *
 * `develop` lets two contacts of one organization carry the same e-mail address, and nothing in the
 * platform relies on the address being unique: the key is a filter for duplicate detection and guest-order
 * matching. `1791000000095` had made `(organizationId, emailKey)` a unique index while the contact
 * subscriber fills `emailKey` on every save, so after the upgrade the second of two such contacts could not
 * be saved at all — a feature removed by an index. The index is now `IDX_organization_contact_org_email`,
 * not unique; the `externalId` index beside it stays unique and is the control.
 *
 * The migration skips every table the fixture does not have, so the fixture is the contact table alone,
 * with the columns `develop` already gives it; the migration adds the rest.
 */
const ORG = '11111111-1111-4111-8111-111111111111';

describe('AlterCoreTablesForExtensions1791000000095 — the contact e-mail index (SQLite)', () => {
	let dataSource: DataSource;
	const migration = new AlterCoreTablesForExtensions1791000000095();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		await dataSource.query(
			`CREATE TABLE "organization_contact" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "name" varchar, "primaryEmail" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime)`
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

	async function indexes(): Promise<Record<string, number>> {
		const list: Array<{ name: string; unique: number }> = await dataSource.query(
			`PRAGMA index_list("organization_contact")`
		);
		return Object.fromEntries(list.map((index) => [index.name, index.unique]));
	}

	async function contact(id: string, email: string, externalId: string | null = null): Promise<void> {
		await dataSource.query(
			`INSERT INTO "organization_contact" ("id", "tenantId", "organizationId", "name", "primaryEmail", "emailKey", "externalId") VALUES (?, 't', ?, ?, ?, ?, ?)`,
			[id, ORG, id, email, email.trim().toLowerCase(), externalId]
		);
	}

	it('indexes (organizationId, emailKey) without a uniqueness rule, and keeps the externalId rule', async () => {
		await run('up');

		const created = await indexes();

		expect(created['IDX_organization_contact_org_email']).toBe(0);
		expect(created['UQ_organization_contact_org_email']).toBeUndefined();
		// CONTROL: the upstream key is still one per organization.
		expect(created['UQ_organization_contact_org_external']).toBe(1);
	});

	it('lets two contacts of one organization share an address, as develop does', async () => {
		await run('up');

		await contact('contact-1', 'Buyer@Example.com');
		await expect(contact('contact-2', 'buyer@example.com ')).resolves.toBeUndefined();

		const rows = await dataSource.query(
			`SELECT "id" FROM "organization_contact" WHERE "organizationId" = ? AND "emailKey" = ? ORDER BY "id"`,
			[ORG, 'buyer@example.com']
		);
		expect(rows.map((row: { id: string }) => row.id)).toEqual(['contact-1', 'contact-2']);
	});

	it('CONTROL: still refuses a second contact with the same upstream key', async () => {
		await run('up');

		await contact('contact-1', 'a@example.com', 'crm-1');
		await expect(contact('contact-2', 'b@example.com', 'crm-1')).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('drops the index on down, and up again recreates it', async () => {
		await run('up');
		await run('down');

		expect((await indexes())['IDX_organization_contact_org_email']).toBeUndefined();

		await run('up');

		expect((await indexes())['IDX_organization_contact_org_email']).toBe(0);
	});
});
