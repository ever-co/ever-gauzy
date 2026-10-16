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

type Column = [name: string, type: (d: EverWorksDialect) => string, notNull?: boolean, def?: string];

const varchar = (n: number) => (d: EverWorksDialect) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`);
const text = () => 'text';
/** The phase checkpoints can outgrow MySQL TEXT's 64 KiB on a large organization: LONGTEXT there. */
const longText = (d: EverWorksDialect) => (d === 'mysql' ? 'longtext' : 'text');
const ts = (d: EverWorksDialect) => (d === 'postgres' ? 'TIMESTAMP' : 'datetime');

const TABLE = 'ever_works_sync_run';
const PREFIX = 'ever_works_sync_run';

const COLUMNS: Column[] = [
	['integrationTenantId', varchar(36), true],
	['connectionId', varchar(36), true],
	['mode', varchar(16), true],
	['reason', varchar(32)],
	['status', varchar(16), true, 'running'],
	['feedHead', varchar(64)],
	['currentPhase', varchar(32)],
	['phases', longText],
	['requestedByUserId', varchar(36)],
	['startedAt', ts],
	['finishedAt', ts],
	['lastProgressAt', ts],
	['lastError', text]
];

const INDEXES: IndexSpec[] = [
	{ name: 'IDX_ever_works_sync_run_integration', columns: ['integrationTenantId', 'createdAt'] },
	{ name: 'IDX_ever_works_sync_run_status', columns: ['status'] },
	{
		// One running run per mapping (MySQL keeps it with the service's lock on the mapping row).
		name: 'UQ_ever_works_sync_run_running',
		columns: ['integrationTenantId'],
		unique: true,
		where: { postgres: `"status" = 'running'`, sqlite: `"status" = 'running'` }
	}
];

function columnSql(d: EverWorksDialect, [name, type, notNull, def]: Column): string {
	const nullable = notNull ? ' NOT NULL' : d === 'mysql' ? ' NULL' : '';
	const defaultSql = def === undefined ? '' : d === 'sqlite' ? ` DEFAULT ('${def}')` : ` DEFAULT '${def}'`;
	return `${q(d, name)} ${type(d)}${nullable}${defaultSql}`;
}

/**
 * The initial sync and resync runs (plan 03 §C.6, G-P1-10): `ever_works_sync_run`. A plugin migration
 * (registered only where `EVER_WORKS_ENABLED=true`), idempotent on Postgres, SQLite and MySQL,
 * serialised on Postgres, and reversible. Additive: no existing table changes.
 */
export class CreateEverWorksSyncRun1791000001550 implements MigrationInterface {
	name = 'CreateEverWorksSyncRun1791000001550';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		const columns = COLUMNS.map((column) => columnSql(d, column)).join(', ');
		if (d === 'postgres') {
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`);
		} else if (d === 'mysql') {
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${columns}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		} else {
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns}, ${sqliteForeignKeys(PREFIX)})`);
		}
		for (const index of [...baseIndexes(PREFIX), ...INDEXES]) {
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
