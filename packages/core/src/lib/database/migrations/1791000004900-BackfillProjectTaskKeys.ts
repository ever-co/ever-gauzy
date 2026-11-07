import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { assignProjectKeys } from '../../tasks/task-reference';

type Dialect = 'postgres' | 'sqlite' | 'mysql';

interface ProjectRow {
	id: string;
	tenantId: string | null;
	organizationId: string | null;
	name: string | null;
	taskKey: string | null;
	taskKeyHistory: string[] | string | null;
}

/**
 * Gives every project without a task key one: the first letters of its name (the key its tasks were already
 * addressed by, `Fulfilment` → `FUL`), made unique within its organization (`FUL2`, …) against every key held or held
 * before there, oldest project first. A project whose name has fewer than two letters or digits keeps none. Keys stay
 * editable by managers; a replaced key keeps resolving through the key history.
 *
 * Only rows without a key are written (`WHERE "taskKey" IS NULL`), so running it again changes nothing, and a lock
 * (advisory on Postgres, named on MySQL) makes two API processes that boot together run it one after the other.
 * `down` changes nothing: a backfilled key cannot be told from one a manager set.
 */
export class BackfillProjectTaskKeys1791000004900 implements MigrationInterface {
	name = 'BackfillProjectTaskKeys1791000004900';

	private readonly advisoryLockKey = 1791000004900;
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		if (!(await queryRunner.hasTable('organization_project')) || !(await queryRunner.hasColumn('organization_project', 'taskKey'))) {
			return;
		}
		const dialect = dialectOf(queryRunner);
		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.apply(queryRunner, dialect));
			return;
		}
		await this.apply(queryRunner, dialect);
	}

	private async apply(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const q = (identifier: string) => quoted(dialect, identifier);
		const rows = (await queryRunner.query(
			`SELECT ${['id', 'tenantId', 'organizationId', 'name', 'taskKey', 'taskKeyHistory'].map(q).join(', ')} FROM ${q('organization_project')} ` +
				`ORDER BY ${q('createdAt')} ASC, ${q('id')} ASC`
		)) as ProjectRow[];
		const byOrganization = new Map<string, ProjectRow[]>();
		for (const row of rows) {
			const scope = `${row.tenantId ?? ''}|${row.organizationId ?? ''}`;
			const group = byOrganization.get(scope);
			if (group) group.push(row);
			else byOrganization.set(scope, [row]);
		}
		let written = 0;
		for (const projects of byOrganization.values()) {
			for (const [id, key] of assignProjectKeys(projects)) {
				await queryRunner.query(
					`UPDATE ${q('organization_project')} SET ${q('taskKey')} = ${param(dialect, 1)} WHERE ${q('id')} = ${param(dialect, 2)} AND ${q('taskKey')} IS NULL`,
					[key, id]
				);
				written += 1;
			}
		}
		console.log(chalk.green(`${this.name}: ${written} project key(s) given.`));
	}

	public async down(): Promise<void> {
		console.log(chalk.yellow(this.name + ': nothing to revert (a backfilled key cannot be told from one a manager set).'));
	}
}

function dialectOf(queryRunner: QueryRunner): Dialect {
	switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
		case DatabaseTypeEnum.postgres:
			return 'postgres';
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return 'sqlite';
		case DatabaseTypeEnum.mysql:
			return 'mysql';
		default:
			throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
	}
}

function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

function param(dialect: Dialect, n: number): string {
	return dialect === 'postgres' ? `$${n}` : '?';
}

async function withMysqlNamedLock(queryRunner: QueryRunner, lockName: string, work: () => Promise<void>): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{ acquired: number | string | null }>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
