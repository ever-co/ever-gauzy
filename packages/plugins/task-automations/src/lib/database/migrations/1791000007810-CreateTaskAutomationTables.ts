import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys,
	TaskAutomationDialect
} from '../migration-helpers';

const RULE = 'task_automation_rule';
const RUN = 'task_automation_run';

type ForeignKey = { name: string; column: string; references: string; onDelete: 'CASCADE' | 'SET NULL' };

/** The rule's own keys: a rule of a deleted project or team goes with it. */
export const TASK_AUTOMATION_RULE_FOREIGN_KEYS: ForeignKey[] = [
	{ name: `FK_${RULE}_project`, column: 'projectId', references: 'organization_project', onDelete: 'CASCADE' },
	{ name: `FK_${RULE}_team`, column: 'organizationTeamId', references: 'organization_team', onDelete: 'CASCADE' }
];

/** The run's own key: the runs of a deleted rule go with it (the task has none: a run outlives its task). */
export const TASK_AUTOMATION_RUN_FOREIGN_KEYS: ForeignKey[] = [
	{ name: `FK_${RUN}_rule`, column: 'ruleId', references: RULE, onDelete: 'CASCADE' }
];

function types(d: TaskAutomationDialect) {
	return {
		uuid: d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar',
		ts: d === 'postgres' ? 'TIMESTAMP' : 'datetime',
		nul: d === 'mysql' ? ' NULL' : '',
		boolFalse: d === 'postgres' ? 'boolean NOT NULL DEFAULT false' : d === 'mysql' ? 'tinyint NOT NULL DEFAULT 0' : 'boolean NOT NULL DEFAULT (0)'
	};
}

/** The rule's own columns, after the base columns, per dialect. */
export function taskAutomationRuleColumns(d: TaskAutomationDialect): string {
	const { uuid, ts, nul, boolFalse } = types(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('name')} varchar(120) NOT NULL`,
		`${c('description')} text${nul}`,
		`${c('projectId')} ${uuid}${nul}`,
		`${c('organizationTeamId')} ${uuid}${nul}`,
		`${c('isEnabled')} ${boolFalse}`,
		`${c('position')} int NOT NULL DEFAULT 0`,
		`${c('templateKey')} varchar(64)${nul}`,
		`${c('triggerType')} varchar(32) NOT NULL`,
		`${c('triggerConfig')} text${nul}`,
		`${c('conditions')} text${nul}`,
		`${c('actions')} text${nul}`,
		`${c('lastRunAt')} ${ts}${nul}`
	].join(', ');
}

/** The run's own columns, after the base columns, per dialect. */
export function taskAutomationRunColumns(d: TaskAutomationDialect): string {
	const { uuid, nul } = types(d);
	const c = (name: string) => q(d, name);
	return [
		`${c('ruleId')} ${uuid} NOT NULL`,
		`${c('taskId')} ${uuid}${nul}`,
		`${c('eventKey')} varchar(160) NOT NULL`,
		`${c('triggerType')} varchar(32) NOT NULL`,
		`${c('outcome')} varchar(24) NOT NULL`,
		`${c('depth')} int NOT NULL DEFAULT 0`,
		`${c('details')} text${nul}`,
		`${c('error')} text${nul}`,
		`${c('durationMs')} int${nul}`
	].join(', ');
}

export const TASK_AUTOMATION_RULE_INDEXES: IndexSpec[] = [
	...baseIndexes(RULE),
	// The engine's read: an organization's rules that are on, of a trigger.
	{ name: `IDX_${RULE}_org_enabled_trigger`, columns: ['organizationId', 'isEnabled', 'triggerType'] },
	{ name: `IDX_${RULE}_project`, columns: ['projectId'] },
	{ name: `IDX_${RULE}_team`, columns: ['organizationTeamId'] }
];

export const TASK_AUTOMATION_RUN_INDEXES: IndexSpec[] = [
	...baseIndexes(RUN),
	// Once per rule and change: the idempotency key.
	{ name: `UQ_${RUN}_rule_event`, columns: ['ruleId', 'eventKey'], unique: true },
	// The history of a rule, newest first; the rate limit of a task.
	{ name: `IDX_${RUN}_rule_created`, columns: ['ruleId', 'createdAt'] },
	{ name: `IDX_${RUN}_task_created`, columns: ['taskId', 'createdAt'] }
];

function sqliteOwnKeys(keys: ForeignKey[]): string {
	return keys
		.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
		)
		.join(', ');
}

async function createTable(
	queryRunner: QueryRunner,
	table: string,
	columns: string,
	ownKeys: ForeignKey[],
	indexes: IndexSpec[]
): Promise<void> {
	const d = dialectOf(queryRunner);
	if (d === 'postgres') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns}, CONSTRAINT "PK_${table}" PRIMARY KEY ("id"))`
		);
	} else if (d === 'mysql') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${table}\` (${baseColumns(d)}, ${columns}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	} else {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns}, ${sqliteForeignKeys(table)}, ${sqliteOwnKeys(ownKeys)})`
		);
	}
	for (const index of indexes) {
		await createIndexIfMissing(queryRunner, table, index);
	}
	for (const fk of [...baseForeignKeys(table), ...ownKeys]) {
		await addForeignKeyIfMissing(queryRunner, table, fk);
	}
}

/**
 * `task_automation_rule` and `task_automation_run` (plan §3). A plugin migration: registered only where
 * `GAUZY_TASK_AUTOMATIONS_ENABLED=true` loads the plugin. Idempotent (re-running issues no DDL), serialised on
 * Postgres (the API processes start together), reversible.
 */
export class CreateTaskAutomationTables1791000007810 implements MigrationInterface {
	name = 'CreateTaskAutomationTables1791000007810';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		await createTable(queryRunner, RULE, taskAutomationRuleColumns(d), TASK_AUTOMATION_RULE_FOREIGN_KEYS, TASK_AUTOMATION_RULE_INDEXES);
		await createTable(queryRunner, RUN, taskAutomationRunColumns(d), TASK_AUTOMATION_RUN_FOREIGN_KEYS, TASK_AUTOMATION_RUN_INDEXES);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, RUN);
		await dropTableIfExists(queryRunner, RULE);
	}
}
