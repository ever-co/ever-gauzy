import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One junction table per many-to-many: `Task.teams` and `Task.members` own their relations through `task_team` and
 * `task_employee`, and the inverse sides (`OrganizationTeam.tasks`, `Employee.tasks`) carried a bare `@JoinTable()`
 * as well, so TypeORM treated them as second owners with junction tables of their own —
 * `organization_team_tasks_task` and `employee_tasks_task` — that nothing ever wrote (every write goes through the
 * task) and that made the query load strategy answer the inverse side empty. The decorators are gone; this
 * migration retires the two tables.
 *
 * Safe on a live database and loses nothing: before a table is dropped, every row it holds is copied into the
 * owning table (`INSERT … SELECT`, duplicates skipped), so a deployment that somehow wrote the inverse side keeps
 * those links through the owner. A table that is already gone is skipped, so running `up` twice is harmless.
 * `down` recreates the two tables empty, as the original schema had them.
 */
export class DropInverseSideTaskJoinTables1791000004925 implements MigrationInterface {
	name = 'DropInverseSideTaskJoinTables1791000004925';

	/** The retired tables and the owning table + columns their rows move to. */
	private readonly tables = [
		{
			name: 'organization_team_tasks_task',
			columns: ['organizationTeamId', 'taskId'],
			owner: 'task_team',
			fk: [
				{ name: 'FK_2a6fb43dc7e7aebcda95e32a107', column: 'organizationTeamId', references: 'organization_team' },
				{ name: 'FK_d15fbe1e1d9c1f56651d8d3831e', column: 'taskId', references: 'task' }
			],
			pk: 'PK_248c1e62556919cafd26cd67052',
			indexes: [
				{ name: 'IDX_2a6fb43dc7e7aebcda95e32a10', column: 'organizationTeamId' },
				{ name: 'IDX_d15fbe1e1d9c1f56651d8d3831', column: 'taskId' }
			]
		},
		{
			name: 'employee_tasks_task',
			columns: ['employeeId', 'taskId'],
			owner: 'task_employee',
			fk: [
				{ name: 'FK_eae5eea1c6a3fcf4a2c95f1a5fe', column: 'employeeId', references: 'employee' },
				{ name: 'FK_6bbbe677c5fc5115916b4eccfb1', column: 'taskId', references: 'task' }
			],
			pk: 'PK_eaa255ec3dabd16698775d00d4a',
			indexes: [
				{ name: 'IDX_eae5eea1c6a3fcf4a2c95f1a5f', column: 'employeeId' },
				{ name: 'IDX_6bbbe677c5fc5115916b4eccfb', column: 'taskId' }
			]
		}
	] as const;

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.retire(queryRunner, 'INSERT OR IGNORE INTO', (n) => `"${n}"`);
				break;
			case DatabaseTypeEnum.postgres:
				await this.retire(queryRunner, 'INSERT INTO', (n) => `"${n}"`, ' ON CONFLICT DO NOTHING');
				break;
			case DatabaseTypeEnum.mysql:
				await this.retire(queryRunner, 'INSERT IGNORE INTO', (n) => `\`${n}\``);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Copies every row of each retired table into its owning table (duplicates skipped), then drops the table.
	 * A table that does not exist is skipped.
	 */
	private async retire(
		queryRunner: QueryRunner,
		insert: string,
		q: (name: string) => string,
		onConflict = ''
	): Promise<void> {
		for (const table of this.tables) {
			if (!(await queryRunner.hasTable(table.name))) {
				console.log(chalk.gray(`${this.name}: ${table.name} is already gone`));
				continue;
			}
			const columns = table.columns.map(q).join(', ');
			const [{ count }] = (await queryRunner.query(`SELECT COUNT(*) AS count FROM ${q(table.name)}`)) as { count: number | string }[];
			if (Number(count) > 0) {
				console.log(chalk.yellow(`${this.name}: moving ${count} row(s) of ${table.name} into ${table.owner}`));
				await queryRunner.query(
					`${insert} ${q(table.owner)} (${columns}) SELECT ${columns} FROM ${q(table.name)}${onConflict}`
				);
			}
			await queryRunner.query(`DROP TABLE ${q(table.name)}`);
			console.log(chalk.green(`${this.name}: dropped ${table.name}`));
		}
	}

	/**
	 * SQLite Down Migration: the tables as `SwitchToMigration1638541848595` created them.
	 */
	private async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		for (const table of this.tables) {
			const [a, b] = table.columns;
			const fks = table.fk
				.map(
					(fk) =>
						`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE CASCADE ON UPDATE CASCADE`
				)
				.join(', ');
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${table.name}" ("${a}" varchar NOT NULL, "${b}" varchar NOT NULL, ${fks}, PRIMARY KEY ("${a}", "${b}"))`
			);
			for (const index of table.indexes) {
				await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" ("${index.column}") `);
			}
		}
	}

	/**
	 * PostgresDB Down Migration: the tables as `SwitchToMigration1638541848595` created them.
	 */
	private async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		for (const table of this.tables) {
			const [a, b] = table.columns;
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${table.name}" ("${a}" uuid NOT NULL, "${b}" uuid NOT NULL, CONSTRAINT "${table.pk}" PRIMARY KEY ("${a}", "${b}"))`
			);
			for (const index of table.indexes) {
				await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" ("${index.column}") `);
			}
			for (const fk of table.fk) {
				await queryRunner.query(`ALTER TABLE "${table.name}" DROP CONSTRAINT IF EXISTS "${fk.name}"`);
				await queryRunner.query(
					`ALTER TABLE "${table.name}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("id") ON DELETE CASCADE ON UPDATE CASCADE`
				);
			}
		}
	}

	/**
	 * MySQL Down Migration: the tables as `MysqlTablesMigration1705138670108` created them.
	 */
	private async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		for (const table of this.tables) {
			const [a, b] = table.columns;
			const indexes = table.indexes.map((index) => `INDEX \`${index.name}\` (\`${index.column}\`)`).join(', ');
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${table.name}\` (\`${a}\` varchar(36) NOT NULL, \`${b}\` varchar(36) NOT NULL, ${indexes}, PRIMARY KEY (\`${a}\`, \`${b}\`)) ENGINE=InnoDB`
			);
			for (const fk of table.fk) {
				await queryRunner.query(
					`ALTER TABLE \`${table.name}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
				);
			}
		}
	}
}
