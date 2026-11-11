import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	columnTypes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	ForeignKeySpec,
	IndexSpec,
	AsanaDialect,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const CONFLICT_TABLE = 'integration_asana_sync_conflict';
const BASELINE_TABLE = 'integration_asana_task_baseline';

/** The conflict's own columns, after the base columns, per dialect. */
function conflictColumns(d: AsanaDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('mappingId')} ${t.varchar(36)}${t.nul}`,
		`${c('runId')} ${t.varchar(36)}${t.nul}`,
		`${c('taskId')} ${t.varchar(36)} NOT NULL`,
		`${c('sourceId')} ${t.varchar(64)} NOT NULL`,
		`${c('field')} ${t.varchar(32)} NOT NULL`,
		`${c('syncedValue')} ${t.text}${t.nul}`,
		`${c('platformValue')} ${t.text}${t.nul}`,
		`${c('externalValue')} ${t.text}${t.nul}`,
		`${c('platformPatch')} ${t.text}${t.nul}`,
		`${c('status')} ${t.varchar(16)} NOT NULL ${t.def('open')}`,
		`${c('resolution')} ${t.varchar(16)}${t.nul}`,
		`${c('resolvedAt')} ${t.timestamp}${t.nul}`,
		`${c('resolvedByUserId')} ${t.varchar(36)}${t.nul}`
	].join(', ');
}

/** The baseline's own columns, per dialect. */
function baselineColumns(d: AsanaDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('sourceId')} ${t.varchar(64)} NOT NULL`,
		`${c('taskId')} ${t.varchar(36)} NOT NULL`,
		`${c('syncedFields')} ${t.text} NOT NULL`
	].join(', ');
}

const CONFLICT_INDEXES: IndexSpec[] = [
	...baseIndexes(CONFLICT_TABLE),
	{ name: `IDX_${CONFLICT_TABLE}_integration`, columns: ['integrationId'] },
	{ name: `IDX_${CONFLICT_TABLE}_mapping`, columns: ['mappingId'] },
	{ name: `IDX_${CONFLICT_TABLE}_run`, columns: ['runId'] },
	{ name: `IDX_${CONFLICT_TABLE}_task`, columns: ['taskId'] },
	{ name: `IDX_${CONFLICT_TABLE}_status`, columns: ['status'] }
];

const CONFLICT_FOREIGN_KEYS: ForeignKeySpec[] = [
	...baseForeignKeys(CONFLICT_TABLE),
	{ name: `FK_${CONFLICT_TABLE}_integration`, column: 'integrationId', references: 'integration_tenant', onDelete: 'CASCADE' }
];

const BASELINE_INDEXES: IndexSpec[] = [
	...baseIndexes(BASELINE_TABLE),
	{ name: `IDX_${BASELINE_TABLE}_integration`, columns: ['integrationId'] },
	/** One baseline per task of a connection. */
	{ name: `UQ_${BASELINE_TABLE}_integration_source`, columns: ['integrationId', 'sourceId'], unique: true }
];

const BASELINE_FOREIGN_KEYS: ForeignKeySpec[] = [
	...baseForeignKeys(BASELINE_TABLE),
	{ name: `FK_${BASELINE_TABLE}_integration`, column: 'integrationId', references: 'integration_tenant', onDelete: 'CASCADE' }
];

async function createTable(queryRunner: QueryRunner, table: string, columns: (d: AsanaDialect) => string, fks: ForeignKeySpec[], indexes: IndexSpec[]) {
	const d = dialectOf(queryRunner);
	if (d === 'postgres') {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns(d)}, CONSTRAINT "PK_${table}" PRIMARY KEY ("id"))`);
	} else if (d === 'mysql') {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`${table}\` (${baseColumns(d)}, ${columns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
	} else {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns(d)}, ${sqliteForeignKeys(fks)})`);
	}
	for (const index of indexes) {
		await createIndexIfMissing(queryRunner, table, index);
	}
	for (const fk of fks) {
		await addForeignKeyIfMissing(queryRunner, table, fk);
	}
}

/**
 * The Asana integration's conflict records: `integration_asana_sync_conflict` (a field changed on both sides,
 * Asana's value applied, the task's kept for a manager) and `integration_asana_task_baseline` (what a task and
 * its task last agreed on). A plugin migration: registered only where `ASANA_ENABLED=true` loads the plugin.
 * Idempotent on every dialect (`IF NOT EXISTS` and probes), serialised on Postgres with an advisory lock, and
 * reversible.
 */
export class CreateIntegrationAsanaConflictTables1791000007020 implements MigrationInterface {
	name = 'CreateIntegrationAsanaConflictTables1791000007020';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createTable(queryRunner, CONFLICT_TABLE, conflictColumns, CONFLICT_FOREIGN_KEYS, CONFLICT_INDEXES);
		await createTable(queryRunner, BASELINE_TABLE, baselineColumns, BASELINE_FOREIGN_KEYS, BASELINE_INDEXES);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, BASELINE_TABLE);
		await dropTableIfExists(queryRunner, CONFLICT_TABLE);
	}
}
