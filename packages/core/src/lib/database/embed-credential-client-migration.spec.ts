import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { CreateEmbedCredentialTable1791000019400 } from './migrations/1791000019400-CreateEmbedCredentialTable';
import {
	AddEmbedCredentialOrganizationContact1791000019600,
	EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY,
	EMBED_CREDENTIAL_CLIENT_INDEX
} from './migrations/1791000019600-AddEmbedCredentialOrganizationContact';

/**
 * `embed_credential.organizationContactId`, run for real on SQLite after the migration that creates the table, against
 * minimal fixtures of the tables they reference: a nullable column every existing credential starts without, indexed,
 * whose contact deleted for good takes the credential with it, never leaving it one of the whole organization.
 */
const CONTACT = 'c0000000-0000-4000-8000-000000000001';
const OTHER_CONTACT = 'c0000000-0000-4000-8000-000000000002';
const EXISTING = 'e0000000-0000-4000-8000-000000000001';
const LIMITED = 'e0000000-0000-4000-8000-000000000002';
const LIMITED_TO_OTHER = 'e0000000-0000-4000-8000-000000000003';

describe('embed_credential.organizationContactId migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-embed-credential-client-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const table of ['tenant', 'organization', 'user', 'organization_contact']) {
			await dataSource.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await dataSource.query(`INSERT INTO "organization_contact" ("id") VALUES (?), (?)`, [CONTACT, OTHER_CONTACT]);
		await migrate(new CreateEmbedCredentialTable1791000019400(), 'up');
		await insertCredential(EXISTING);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const migrate = async (migration: MigrationInterface, direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const run = (direction: 'up' | 'down') =>
		migrate(new AddEmbedCredentialOrganizationContact1791000019600(), direction);

	const insertCredential = async (id: string) => {
		await dataSource.query(
			`INSERT INTO "embed_credential" ("id", "name", "keyHash", "prefix") VALUES (?, 'Portal', ?, 'gze_x')`,
			[id, `hash-${id}`]
		);
	};

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(embed_credential)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
		}>;
		return columns.find((it) => it.name === 'organizationContactId');
	};

	const indexNames = async (): Promise<string[]> => {
		const indexes = (await dataSource.query('PRAGMA index_list(embed_credential)')) as Array<{ name: string }>;
		return indexes.map((index) => index.name);
	};

	const credentialIds = async (): Promise<string[]> => {
		const rows = (await dataSource.query('SELECT "id" FROM "embed_credential" ORDER BY "id"')) as Array<{
			id: string;
		}>;
		return rows.map((row) => row.id);
	};

	it('adds a nullable, indexed column referencing the contact, which every existing credential starts without', async () => {
		await run('up');

		expect(await column()).toMatchObject({ notnull: 0, dflt_value: null });
		expect(await indexNames()).toContain(EMBED_CREDENTIAL_CLIENT_INDEX);
		const foreignKeys = (await dataSource.query('PRAGMA foreign_key_list(embed_credential)')) as Array<{
			table: string;
		}>;
		expect(foreignKeys.filter((key) => key.table === 'organization_contact')).toEqual([
			expect.objectContaining({ from: 'organizationContactId', to: 'id', on_delete: 'CASCADE' })
		]);
		const [existing] = await dataSource.query(
			`SELECT "organizationContactId" FROM "embed_credential" WHERE "id" = ?`,
			[EXISTING]
		);
		expect(existing.organizationContactId).toBeNull();
	});

	it('deletes the credentials of a contact deleted for good, and keeps every other one', async () => {
		await run('up');
		await insertCredential(LIMITED);
		await insertCredential(LIMITED_TO_OTHER);
		await dataSource.query(`UPDATE "embed_credential" SET "organizationContactId" = ? WHERE "id" = ?`, [
			CONTACT,
			LIMITED
		]);
		await dataSource.query(`UPDATE "embed_credential" SET "organizationContactId" = ? WHERE "id" = ?`, [
			OTHER_CONTACT,
			LIMITED_TO_OTHER
		]);

		await dataSource.query(`DELETE FROM "organization_contact" WHERE "id" = ?`, [CONTACT]);

		expect(await credentialIds()).toEqual([EXISTING, LIMITED_TO_OTHER]);
	});

	it('is a no-op when run twice, drops the index on down and keeps the column, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();

		await run('down');
		expect(await indexNames()).not.toContain(EMBED_CREDENTIAL_CLIENT_INDEX);
		expect(await column()).toBeDefined();

		await run('up');
		expect(await indexNames()).toContain(EMBED_CREDENTIAL_CLIENT_INDEX);
		expect(await credentialIds()).toEqual([EXISTING]);
	});
});

/** A query runner that records the statements it is given, answering the checks as the arguments say. */
function scriptedRunner(
	type: 'postgres' | 'mysql',
	state: { hasTable?: boolean; hasColumn: boolean; hasKeyAndIndex: boolean }
) {
	const queries: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => state.hasTable !== false,
		hasColumn: async () => state.hasColumn,
		getTable: async () => ({
			foreignKeys: state.hasKeyAndIndex ? [{ name: EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY }] : [],
			indices: state.hasKeyAndIndex ? [{ name: EMBED_CREDENTIAL_CLIENT_INDEX }] : []
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

describe('embed_credential.organizationContactId migration on Postgres', () => {
	it('serialises concurrent runs and adds the column, its index and its cascading foreign key', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: false, hasKeyAndIndex: false });

		await new AddEmbedCredentialOrganizationContact1791000019600().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "embed_credential" ADD COLUMN IF NOT EXISTS "organizationContactId" uuid',
			`CREATE INDEX IF NOT EXISTS "${EMBED_CREDENTIAL_CLIENT_INDEX}" ON "embed_credential" ("organizationContactId")`,
			`ALTER TABLE "embed_credential" ADD CONSTRAINT "${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		]);
	});

	it('adds no column, index or key that is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true, hasKeyAndIndex: true });

		await new AddEmbedCredentialOrganizationContact1791000019600().up(queryRunner);

		expect(queries.some((sql) => sql.startsWith('ALTER TABLE'))).toBe(false);
	});

	it('changes nothing without the table', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', {
			hasTable: false,
			hasColumn: false,
			hasKeyAndIndex: false
		});

		await new AddEmbedCredentialOrganizationContact1791000019600().up(queryRunner);
		await new AddEmbedCredentialOrganizationContact1791000019600().down(queryRunner);

		expect(queries).toEqual([]);
	});

	it('drops the foreign key, the index and the column on down', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true, hasKeyAndIndex: true });

		await new AddEmbedCredentialOrganizationContact1791000019600().down(queryRunner);

		expect(queries).toEqual([
			`ALTER TABLE "embed_credential" DROP CONSTRAINT IF EXISTS "${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}"`,
			`DROP INDEX IF EXISTS "${EMBED_CREDENTIAL_CLIENT_INDEX}"`,
			'ALTER TABLE "embed_credential" DROP COLUMN IF EXISTS "organizationContactId"'
		]);
	});
});

describe('embed_credential.organizationContactId migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds the column, then its index, then its foreign key', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: false, hasKeyAndIndex: false });
		const migration = new AddEmbedCredentialOrganizationContact1791000019600();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `embed_credential` ADD COLUMN `organizationContactId` varchar(255) NULL',
			`CREATE INDEX \`${EMBED_CREDENTIAL_CLIENT_INDEX}\` ON \`embed_credential\` (\`organizationContactId\`)`,
			`ALTER TABLE \`embed_credential\` ADD CONSTRAINT \`${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('writes nothing when everything is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true, hasKeyAndIndex: true });

		await new AddEmbedCredentialOrganizationContact1791000019600().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});

	it('drops the foreign key before the index it needs, then the column, on down', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true, hasKeyAndIndex: true });

		await new AddEmbedCredentialOrganizationContact1791000019600().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			`ALTER TABLE \`embed_credential\` DROP FOREIGN KEY \`${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}\``,
			`DROP INDEX \`${EMBED_CREDENTIAL_CLIENT_INDEX}\` ON \`embed_credential\``,
			'ALTER TABLE `embed_credential` DROP COLUMN `organizationContactId`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
