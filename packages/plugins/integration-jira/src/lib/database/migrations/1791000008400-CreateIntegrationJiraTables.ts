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
	JiraDialect,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const MAPPING_TABLE = 'integration_jira_project_mapping';
const RUN_TABLE = 'integration_jira_sync_run';
const CONFLICT_TABLE = 'integration_jira_sync_conflict';
const BASELINE_TABLE = 'integration_jira_issue_baseline';

/** The mapping's own columns, after the base columns, per dialect. */
function mappingColumns(d: JiraDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('jiraProjectId')} ${t.varchar(64)} NOT NULL`,
		`${c('jiraProjectKey')} ${t.varchar(32)}${t.nul}`,
		`${c('jiraProjectName')} ${t.varchar(255)}${t.nul}`,
		`${c('projectId')} ${t.uuid} NOT NULL`,
		`${c('direction')} ${t.varchar(16)} NOT NULL ${t.def('inbound')}`,
		`${c('statusMap')} ${t.text}${t.nul}`,
		`${c('issueTypeIds')} ${t.text}${t.nul}`,
		`${c('syncEnabled')} ${t.boolean(true)}`,
		`${c('lastImportedAt')} ${t.timestamp}${t.nul}`,
		`${c('lastCursor')} ${t.varchar(64)}${t.nul}`,
		`${c('lastError')} ${t.text}${t.nul}`
	].join(', ');
}

/** The run's own columns, per dialect. */
function runColumns(d: JiraDialect): string {
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
		`${c('report')} ${t.text}${t.nul}`,
		`${c('lastError')} ${t.text}${t.nul}`
	].join(', ');
}

/** The conflict's own columns, per dialect. */
function conflictColumns(d: JiraDialect): string {
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
function baselineColumns(d: JiraDialect): string {
	const t = columnTypes(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('integrationId')} ${t.uuid} NOT NULL`,
		`${c('sourceId')} ${t.varchar(64)} NOT NULL`,
		`${c('taskId')} ${t.varchar(36)} NOT NULL`,
		`${c('syncedFields')} ${t.text} NOT NULL`
	].join(', ');
}

const integrationFk = (table: string): ForeignKeySpec => ({
	name: `FK_${table}_integration`,
	column: 'integrationId',
	references: 'integration_tenant',
	onDelete: 'CASCADE'
});

/** A table: its columns, foreign keys and indexes. */
interface TableSpec {
	name: string;
	columns: (d: JiraDialect) => string;
	foreignKeys: ForeignKeySpec[];
	indexes: IndexSpec[];
}

/** The tables, in creation order (dropped in reverse). */
export const JIRA_TABLES: readonly TableSpec[] = [
	{
		name: MAPPING_TABLE,
		columns: mappingColumns,
		foreignKeys: [
			...baseForeignKeys(MAPPING_TABLE),
			integrationFk(MAPPING_TABLE),
			{ name: `FK_${MAPPING_TABLE}_project`, column: 'projectId', references: 'organization_project', onDelete: 'CASCADE' }
		],
		indexes: [
			...baseIndexes(MAPPING_TABLE),
			{ name: `IDX_${MAPPING_TABLE}_integration`, columns: ['integrationId'] },
			{ name: `IDX_${MAPPING_TABLE}_jira_project`, columns: ['jiraProjectId'] },
			{ name: `IDX_${MAPPING_TABLE}_project`, columns: ['projectId'] },
			/** One mapping per Jira project of a connection. */
			{ name: `UQ_${MAPPING_TABLE}_integration_jira_project`, columns: ['integrationId', 'jiraProjectId'], unique: true }
		]
	},
	{
		name: RUN_TABLE,
		columns: runColumns,
		foreignKeys: [...baseForeignKeys(RUN_TABLE), integrationFk(RUN_TABLE)],
		indexes: [
			...baseIndexes(RUN_TABLE),
			{ name: `IDX_${RUN_TABLE}_integration`, columns: ['integrationId'] },
			{ name: `IDX_${RUN_TABLE}_mapping`, columns: ['mappingId'] },
			{ name: `IDX_${RUN_TABLE}_status`, columns: ['status'] }
		]
	},
	{
		name: CONFLICT_TABLE,
		columns: conflictColumns,
		foreignKeys: [...baseForeignKeys(CONFLICT_TABLE), integrationFk(CONFLICT_TABLE)],
		indexes: [
			...baseIndexes(CONFLICT_TABLE),
			{ name: `IDX_${CONFLICT_TABLE}_integration`, columns: ['integrationId'] },
			{ name: `IDX_${CONFLICT_TABLE}_mapping`, columns: ['mappingId'] },
			{ name: `IDX_${CONFLICT_TABLE}_run`, columns: ['runId'] },
			{ name: `IDX_${CONFLICT_TABLE}_task`, columns: ['taskId'] },
			{ name: `IDX_${CONFLICT_TABLE}_status`, columns: ['status'] }
		]
	},
	{
		name: BASELINE_TABLE,
		columns: baselineColumns,
		foreignKeys: [...baseForeignKeys(BASELINE_TABLE), integrationFk(BASELINE_TABLE)],
		indexes: [
			...baseIndexes(BASELINE_TABLE),
			{ name: `IDX_${BASELINE_TABLE}_integration`, columns: ['integrationId'] },
			/** One baseline per issue of a connection. */
			{ name: `UQ_${BASELINE_TABLE}_integration_source`, columns: ['integrationId', 'sourceId'], unique: true }
		]
	}
];

async function createTable(queryRunner: QueryRunner, table: TableSpec) {
	const d = dialectOf(queryRunner);
	if (d === 'postgres') {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${baseColumns(d)}, ${table.columns(d)}, CONSTRAINT "PK_${table.name}" PRIMARY KEY ("id"))`);
	} else if (d === 'mysql') {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`${table.name}\` (${baseColumns(d)}, ${table.columns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
	} else {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${baseColumns(d)}, ${table.columns(d)}, ${sqliteForeignKeys(table.foreignKeys)})`);
	}
	for (const index of table.indexes) {
		await createIndexIfMissing(queryRunner, table.name, index);
	}
	for (const fk of table.foreignKeys) {
		await addForeignKeyIfMissing(queryRunner, table.name, fk);
	}
}

/**
 * The Jira Cloud integration's tables: `integration_jira_project_mapping` (a Jira project ↔ a project, with its status
 * map and issue types), `integration_jira_sync_run` (one import or webhook application, with its report),
 * `integration_jira_sync_conflict` (a field changed on both sides, Jira's value applied, the task's kept for a manager)
 * and `integration_jira_issue_baseline` (what an issue and its task last agreed on). A plugin migration: registered
 * only where `JIRA_ENABLED=true` loads the sync. Idempotent on every dialect (`IF NOT EXISTS` and probes), serialised
 * on Postgres with an advisory lock, and reversible.
 */
export class CreateIntegrationJiraTables1791000008400 implements MigrationInterface {
	name = 'CreateIntegrationJiraTables1791000008400';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		for (const table of JIRA_TABLES) {
			await createTable(queryRunner, table);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		for (const table of [...JIRA_TABLES].reverse()) {
			await dropTableIfExists(queryRunner, table.name);
		}
	}
}
