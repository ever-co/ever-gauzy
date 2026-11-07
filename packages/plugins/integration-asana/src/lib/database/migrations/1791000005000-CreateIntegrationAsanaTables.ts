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

const MAPPING_TABLE = 'integration_asana_project_mapping';
const RUN_TABLE = 'integration_asana_sync_run';

/** The mapping's own columns, after the base columns, per dialect. */
function mappingColumns(d: AsanaDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('asanaWorkspaceGid')} ${t.varchar(64)} NOT NULL`,
		`${c('asanaProjectGid')} ${t.varchar(64)} NOT NULL`,
		`${c('asanaProjectName')} ${t.varchar(255)}${t.nul}`,
		`${c('projectId')} ${t.uuid} NOT NULL`,
		`${c('direction')} ${t.varchar(16)} NOT NULL ${t.def('inbound')}`,
		`${c('sectionMap')} ${t.text}${t.nul}`,
		`${c('syncEnabled')} ${t.boolean(true)}`,
		`${c('webhookGid')} ${t.varchar(64)}${t.nul}`,
		`${c('webhookSecret')} ${t.varchar(255)}${t.nul}`,
		`${c('webhookHandshakeToken')} ${t.varchar(64)}${t.nul}`,
		`${c('webhookHandshakeStartedAt')} ${t.timestamp}${t.nul}`,
		`${c('lastImportedAt')} ${t.timestamp}${t.nul}`,
		`${c('lastCursor')} ${t.varchar(64)}${t.nul}`,
		`${c('lastError')} ${t.text}${t.nul}`
	].join(', ');
}

/** The run's own columns, per dialect. */
function runColumns(d: AsanaDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('mappingId')} ${t.varchar(36)}${t.nul}`,
		`${c('kind')} ${t.varchar(16)} NOT NULL`,
		`${c('status')} ${t.varchar(16)} NOT NULL ${t.def('running')}`,
		`${c('requestedByUserId')} ${t.varchar(36)}${t.nul}`,
		`${c('full')} ${t.boolean(false)}`,
		`${c('startedAt')} ${t.timestamp}${t.nul}`,
		`${c('finishedAt')} ${t.timestamp}${t.nul}`,
		`${c('createdCount')} ${t.integer} NOT NULL DEFAULT 0`,
		`${c('updatedCount')} ${t.integer} NOT NULL DEFAULT 0`,
		`${c('skippedCount')} ${t.integer} NOT NULL DEFAULT 0`,
		`${c('failedCount')} ${t.integer} NOT NULL DEFAULT 0`,
		`${c('cursor')} ${t.varchar(64)}${t.nul}`,
		`${c('lastError')} ${t.text}${t.nul}`
	].join(', ');
}

const MAPPING_INDEXES: IndexSpec[] = [
	...baseIndexes(MAPPING_TABLE),
	{ name: `IDX_${MAPPING_TABLE}_integration`, columns: ['integrationId'] },
	{ name: `IDX_${MAPPING_TABLE}_asana_project`, columns: ['asanaProjectGid'] },
	{ name: `IDX_${MAPPING_TABLE}_project`, columns: ['projectId'] },
	/** One mapping per Asana project of a connection. */
	{ name: `UQ_${MAPPING_TABLE}_integration_asana_project`, columns: ['integrationId', 'asanaProjectGid'], unique: true }
];

const MAPPING_FOREIGN_KEYS: ForeignKeySpec[] = [
	...baseForeignKeys(MAPPING_TABLE),
	{ name: `FK_${MAPPING_TABLE}_integration`, column: 'integrationId', references: 'integration_tenant', onDelete: 'CASCADE' },
	{ name: `FK_${MAPPING_TABLE}_project`, column: 'projectId', references: 'organization_project', onDelete: 'CASCADE' }
];

const RUN_INDEXES: IndexSpec[] = [
	...baseIndexes(RUN_TABLE),
	{ name: `IDX_${RUN_TABLE}_integration`, columns: ['integrationId'] },
	{ name: `IDX_${RUN_TABLE}_mapping`, columns: ['mappingId'] },
	{ name: `IDX_${RUN_TABLE}_status`, columns: ['status'] }
];

const RUN_FOREIGN_KEYS: ForeignKeySpec[] = [
	...baseForeignKeys(RUN_TABLE),
	{ name: `FK_${RUN_TABLE}_integration`, column: 'integrationId', references: 'integration_tenant', onDelete: 'CASCADE' }
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
 * The Asana integration's tables: `integration_asana_project_mapping` (an Asana project ↔ a platform project, with
 * its webhook) and `integration_asana_sync_run` (one import or webhook application). A plugin migration:
 * registered only where `ASANA_ENABLED=true` loads the plugin. Idempotent on every dialect, serialised on
 * Postgres with an advisory lock, and reversible.
 */
export class CreateIntegrationAsanaTables1791000005000 implements MigrationInterface {
	name = 'CreateIntegrationAsanaTables1791000005000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createTable(queryRunner, MAPPING_TABLE, mappingColumns, MAPPING_FOREIGN_KEYS, MAPPING_INDEXES);
		await createTable(queryRunner, RUN_TABLE, runColumns, RUN_FOREIGN_KEYS, RUN_INDEXES);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, RUN_TABLE);
		await dropTableIfExists(queryRunner, MAPPING_TABLE);
	}
}
