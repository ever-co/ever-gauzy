// cspell:ignore conrelid confrelid confdeltype conkey relnamespace nspname relname conname attrelid attnum attname
import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, lockMigrations } from '../migration-helpers';

const TABLE = 'ever_works_connection';
/** The name `CreateEverWorksConnection1791000001100` gave the organization foreign key. */
const FK = 'FK_ever_works_connection_organization';
/** SQLite's copy while the table is rebuilt. */
const REBUILD = `temporary_${TABLE}`;

/** What a deleted organization does to the connection row: `SET NULL` from this migration on, `CASCADE` before. */
type DeleteRule = 'SET NULL' | 'CASCADE';

/**
 * Keeps the tenant's Ever Works connection when the organization it was connected from is deleted
 * (review finding F59).
 *
 * The connection is tenant-level: one row per tenant, and every mapped organization points at it through
 * its `integration_tenant`. `organizationId` only records where an admin connected from. Its foreign key was
 * `ON DELETE CASCADE` (the base foreign keys every plugin table gets), so hard-deleting that one organization
 * also deleted the connection, with its encrypted key, feed cursor and webhook id, and stopped the sync of
 * every other mapped organization. Now the column is set to NULL instead; the tenant foreign key keeps
 * `CASCADE` (a deleted tenant takes its connection with it).
 *
 * - Postgres and MySQL: the organization foreign key is found by its column and referenced table, not only by
 *   name (an install whose schema came from `synchronize` names it differently), dropped, and added again with
 *   the new rule. Postgres runs it inside the migration's transaction under a 5 s lock timeout (adding a
 *   foreign key briefly locks `organization`); MySQL commits each statement on its own, so every step is
 *   probed first and a run cut off between the drop and the add finishes on the next start.
 * - SQLite declares foreign keys inside `CREATE TABLE`, so the table is rebuilt from its CURRENT definition in
 *   `sqlite_master` (only the rule of the organization clause changes): copy, drop, rename, then its indexes
 *   are created again. No table references `ever_works_connection`, so dropping the old copy never cascades;
 *   TypeORM also turns foreign keys off while it runs migrations.
 *
 * A plugin migration (registered only where `EVER_WORKS_ENABLED=true`), idempotent on every dialect (a re-run
 * issues no DDL) and reversible: `down` puts `CASCADE` back. Rows whose organization was deleted meanwhile
 * keep `organizationId` NULL after `down`.
 */
export class AlterEverWorksConnectionOrganizationForeignKey1791000003100 implements MigrationInterface {
	name = 'AlterEverWorksConnectionOrganizationForeignKey1791000003100';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await this.setOrganizationDeleteRule(queryRunner, 'SET NULL');
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await this.setOrganizationDeleteRule(queryRunner, 'CASCADE');
	}

	private async setOrganizationDeleteRule(queryRunner: QueryRunner, rule: DeleteRule): Promise<void> {
		await lockMigrations(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;
		const dialect = dialectOf(queryRunner);
		if (dialect === 'postgres') await this.postgres(queryRunner, rule);
		else if (dialect === 'mysql') await this.mysql(queryRunner, rule);
		else await this.sqlite(queryRunner, rule);
	}

	/** Postgres: replace every organization foreign key of the wrong rule by the named one with `rule`. */
	private async postgres(queryRunner: QueryRunner, rule: DeleteRule): Promise<void> {
		const code = rule === 'SET NULL' ? 'n' : 'c';
		const keys: Array<{ name: string; rule: string }> = await queryRunner.query(
			`SELECT c."conname" AS "name", c."confdeltype" AS "rule"
			FROM "pg_constraint" c
			JOIN "pg_class" t ON t."oid" = c."conrelid"
			JOIN "pg_namespace" n ON n."oid" = t."relnamespace"
			JOIN "pg_class" r ON r."oid" = c."confrelid"
			WHERE c."contype" = 'f' AND n."nspname" = current_schema() AND t."relname" = $1 AND r."relname" = 'organization'
			AND c."conkey" = ARRAY[(SELECT a."attnum" FROM "pg_attribute" a WHERE a."attrelid" = t."oid" AND a."attname" = 'organizationId')]`,
			[TABLE]
		);
		const stale = keys.filter((key) => key.rule !== code);
		const kept = keys.some((key) => key.rule === code);
		if (!stale.length && kept) return;
		await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
		for (const key of stale) {
			await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT "${key.name}"`);
		}
		if (!kept) {
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${FK}" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE ${rule} ON UPDATE NO ACTION`
			);
		}
	}

	/** MySQL: the same, one probed statement at a time (each DDL statement commits on its own). */
	private async mysql(queryRunner: QueryRunner, rule: DeleteRule): Promise<void> {
		const keys: Array<{ name: string; rule: string }> = await queryRunner.query(
			`SELECT rc.\`CONSTRAINT_NAME\` AS \`name\`, rc.\`DELETE_RULE\` AS \`rule\`
			FROM \`information_schema\`.\`REFERENTIAL_CONSTRAINTS\` rc
			JOIN \`information_schema\`.\`KEY_COLUMN_USAGE\` k
				ON k.\`CONSTRAINT_SCHEMA\` = rc.\`CONSTRAINT_SCHEMA\` AND k.\`CONSTRAINT_NAME\` = rc.\`CONSTRAINT_NAME\` AND k.\`TABLE_NAME\` = rc.\`TABLE_NAME\`
			WHERE rc.\`CONSTRAINT_SCHEMA\` = DATABASE() AND rc.\`TABLE_NAME\` = ? AND rc.\`REFERENCED_TABLE_NAME\` = 'organization'
			AND k.\`COLUMN_NAME\` = 'organizationId'`,
			[TABLE]
		);
		for (const key of keys.filter((key) => key.rule !== rule)) {
			await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${key.name}\``);
		}
		if (!keys.some((key) => key.rule === rule)) {
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${FK}\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE ${rule} ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * SQLite: rebuild the table with the organization clause's rule swapped. The definition is derived from
	 * `sqlite_master`, never restated by hand, so columns added by later migrations come along.
	 */
	private async sqlite(queryRunner: QueryRunner, rule: DeleteRule): Promise<void> {
		const [table]: Array<{ sql: string }> = await queryRunner.query(
			`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = ?`,
			[TABLE]
		);
		const clause =
			/(FOREIGN KEY\s*\(\s*"organizationId"\s*\)\s*REFERENCES\s*"organization"\s*\(\s*"id"\s*\)\s*ON DELETE\s+)(SET NULL|SET DEFAULT|CASCADE|RESTRICT|NO ACTION)/i;
		const match = table?.sql.match(clause);
		// No organization foreign key at all: deleting an organization cannot cascade, nothing to change.
		if (!table?.sql || !match || match[2].toUpperCase() === rule) return;

		// A table that references the connection would lose rows when the old copy is dropped with foreign keys
		// on (TypeORM turns them off for migrations; a direct call may not). None does today: refuse rather than
		// risk it if one is ever added.
		const [{ foreign_keys: enforced } = { foreign_keys: 0 }]: Array<{ foreign_keys: number }> =
			await queryRunner.query(`PRAGMA foreign_keys`);
		if (enforced) {
			const dependents: Array<{ name: string }> = await queryRunner.query(
				`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" NOT IN (?, ?) AND "sql" LIKE ?`,
				[TABLE, REBUILD, `%REFERENCES "${TABLE}"%`]
			);
			if (dependents.length) {
				throw new Error(
					`${this.name}: ${dependents.map((d) => d.name).join(', ')} reference ${TABLE}; run it with foreign keys off`
				);
			}
		}

		const definition = table.sql
			.replace(clause, `$1${rule}`)
			.replace(
				new RegExp(
					`^CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?(?:"${TABLE}"|'${TABLE}'|\`${TABLE}\`|${TABLE})`,
					'i'
				),
				`CREATE TABLE "${REBUILD}"`
			);
		if (!definition.startsWith(`CREATE TABLE "${REBUILD}"`)) {
			throw new Error(`${this.name}: unexpected definition of ${TABLE}`);
		}
		const indexes: Array<{ sql: string }> = await queryRunner.query(
			`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = ? AND "sql" IS NOT NULL`,
			[TABLE]
		);
		const columns: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("${TABLE}")`);
		const list = columns.map(({ name }) => `"${name}"`).join(', ');

		// A copy left by a run that stopped before its rename (SQLite DDL is transactional, so only a run outside
		// a transaction can leave one) is discarded: the original table is still complete.
		await queryRunner.query(`DROP TABLE IF EXISTS "${REBUILD}"`);
		await queryRunner.query(definition);
		await queryRunner.query(`INSERT INTO "${REBUILD}" (${list}) SELECT ${list} FROM "${TABLE}"`);
		await queryRunner.query(`DROP TABLE "${TABLE}"`);
		await queryRunner.query(`ALTER TABLE "${REBUILD}" RENAME TO "${TABLE}"`);
		for (const { sql } of indexes) {
			await queryRunner.query(sql);
		}
	}
}
