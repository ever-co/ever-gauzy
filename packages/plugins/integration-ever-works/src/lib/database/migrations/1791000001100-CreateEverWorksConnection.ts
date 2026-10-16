import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	EverWorksDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const TABLE = 'ever_works_connection';
const PREFIX = 'ever_works_connection';

/** The connection's own columns, after the base columns, per dialect. */
function columns(d: EverWorksDialect): string {
	const varchar = (n: number) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`);
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : d === 'mysql' ? 'datetime' : 'datetime';
	const nul = d === 'mysql' ? ' NULL' : '';
	const def = (value: string) => (d === 'sqlite' ? `DEFAULT ('${value}')` : `DEFAULT '${value}'`);
	const c = (name: string) => q(d, name);
	return [
		`${c('authMode')} ${varchar(16)} NOT NULL ${def('api_key')}`,
		`${c('status')} ${varchar(20)} NOT NULL ${def('active')}`,
		`${c('apiBaseUrl')} ${varchar(2048)} NOT NULL`,
		`${c('ewTenantId')} ${varchar(64)} NOT NULL`,
		`${c('ewTenantSlug')} ${varchar(64)}${nul}`,
		`${c('keyId')} ${varchar(64)}${nul}`,
		`${c('keyName')} ${varchar(255)}${nul}`,
		`${c('keyPrefix')} ${varchar(32)}${nul}`,
		`${c('apiKeyEncrypted')} text NOT NULL`,
		`${c('scopes')} text${nul}`,
		`${c('pinnedOrganizations')} text${nul}`,
		`${c('apiVersion')} ${varchar(16)}${nul}`,
		`${c('webhookSubscriptionId')} ${varchar(64)}${nul}`,
		`${c('webhookSecretEncrypted')} text${nul}`,
		`${c('webhookUrl')} ${varchar(2048)}${nul}`,
		`${c('feedCursor')} ${varchar(64)}${nul}`,
		`${c('lastError')} text${nul}`,
		`${c('lastErrorAt')} ${ts}${nul}`,
		`${c('lastHealthyAt')} ${ts}${nul}`,
		`${c('lastCheckedAt')} ${ts}${nul}`,
		`${c('connectedByUserId')} ${uuid}${nul}`,
		`${c('disconnectedAt')} ${ts}${nul}`
	].join(', ');
}

/** The connection's indexes; the partial unique index keeps one active connection per tenant. */
const INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_status`, columns: ['status'] },
	{ name: `IDX_${PREFIX}_ew_tenant`, columns: ['ewTenantId'] },
	{
		name: `UQ_${PREFIX}_active_tenant`,
		columns: ['tenantId'],
		unique: true,
		where: {
			postgres: `"isActive" = true AND "deletedAt" IS NULL`,
			sqlite: `"isActive" = 1 AND "deletedAt" IS NULL`
		}
	}
];

/**
 * `ever_works_connection` (plan 02 §4, G-P1-3): one Gauzy tenant's connection to Ever Works, with the
 * integration key and the webhook signing secret stored only encrypted.
 *
 * A plugin migration: it is registered only where `EVER_WORKS_ENABLED=true` loads the plugin, so an
 * installation that has not switched the integration on never gets the table. Idempotent on every
 * dialect (`IF NOT EXISTS` and probes; a re-run issues no DDL), serialised on Postgres with an advisory
 * lock, and reversible (`down` drops the table, its indexes and constraints).
 */
export class CreateEverWorksConnection1791000001100 implements MigrationInterface {
	name = 'CreateEverWorksConnection1791000001100';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns(d)}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${columns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns(d)}, ${sqliteForeignKeys(PREFIX)})`);
		}
		for (const index of INDEXES) {
			await createIndexIfMissing(queryRunner, TABLE, index);
		}
		for (const fk of baseForeignKeys(PREFIX)) {
			await addForeignKeyIfMissing(queryRunner, TABLE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
