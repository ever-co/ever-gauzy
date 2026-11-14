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

const CLOSURE = 'task_automation_link_closure';

/** The closure's own columns, after the base columns, per dialect. */
export function taskAutomationLinkClosureColumns(d: TaskAutomationDialect): string {
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const c = (name: string) => q(d, name);
	return [
		`${c('taskId')} ${uuid} NOT NULL`,
		`${c('provider')} varchar(32) NOT NULL`,
		`${c('kind')} varchar(24) NOT NULL`,
		`${c('externalId')} varchar(255) NOT NULL`
	].join(', ');
}

export const TASK_AUTOMATION_LINK_CLOSURE_INDEXES: IndexSpec[] = [
	...baseIndexes(CLOSURE),
	// Once per task and link: the identity a close is reported under.
	{ name: `UQ_${CLOSURE}_task_link`, columns: ['tenantId', 'taskId', 'provider', 'kind', 'externalId'], unique: true }
];

/**
 * `task_automation_link_closure` (spec T16): the closed links of tasks already handed to the automations as
 * `task_link.closed`, so a close delivered again appends nothing. A plugin migration: registered only where
 * `GAUZY_TASK_AUTOMATIONS_ENABLED=true` loads the plugin. Idempotent, serialised on Postgres, reversible.
 */
export class CreateTaskAutomationLinkClosureTable1791000009110 implements MigrationInterface {
	name = 'CreateTaskAutomationLinkClosureTable1791000009110';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		const columns = taskAutomationLinkClosureColumns(d);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${CLOSURE}" (${baseColumns(d)}, ${columns}, CONSTRAINT "PK_${CLOSURE}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${CLOSURE}\` (${baseColumns(d)}, ${columns}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${CLOSURE}" (${baseColumns(d)}, ${columns}, ${sqliteForeignKeys(CLOSURE)})`);
		}
		for (const index of TASK_AUTOMATION_LINK_CLOSURE_INDEXES) {
			await createIndexIfMissing(queryRunner, CLOSURE, index);
		}
		for (const fk of baseForeignKeys(CLOSURE)) {
			await addForeignKeyIfMissing(queryRunner, CLOSURE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, CLOSURE);
	}
}
