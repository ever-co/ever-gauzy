import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/**
 * Recounts `organization_project.membersCount` with the members who still work in the organization.
 *
 * "End Work" deactivates and archives an employee (`isActive = false`, `isArchived = true`) but keeps their project
 * memberships, so that "Back to Work" restores them. The count used to include them: the Projects page read
 * "Members count 6" for a project whose working members were fewer, and the employees whose work had ended were
 * listed among the members while the edit form, which offers working employees only, could not take them off. The
 * API now leaves them out of the member lists and of the count, and recounts an employee's projects when their
 * work starts or ends; this migration brings the stored counts in line once.
 *
 * The statement only rewrites a derived counter from the membership rows, so running it again is harmless, and
 * `down` restores the former count of every membership row.
 */
export class RecountProjectMembersOfWorkingEmployees1791000003430 implements MigrationInterface {
	name = 'RecountProjectMembersOfWorkingEmployees1791000003430';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		await this.recount(queryRunner, true);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
		await this.recount(queryRunner, false);
	}

	/**
	 * Sets every project's `membersCount` to the number of its membership rows: of working employees only, or of
	 * all of them as before.
	 */
	private async recount(queryRunner: QueryRunner, workingOnly: boolean): Promise<void> {
		const dialect = this.dialectOf(queryRunner);
		for (const table of ['organization_project', 'organization_project_employee', 'employee']) {
			if (!(await queryRunner.hasTable(table))) return;
		}

		const q = (identifier: string) => quoted(dialect, identifier);
		// `TRUE` / `FALSE` are literals: Postgres, MySQL and SQLite (3.23+) all read them.
		const working = workingOnly
			? `INNER JOIN ${q('employee')} ON ${q('employee')}.${q('id')} = ${q('organization_project_employee')}.${q('employeeId')}
				AND ${q('employee')}.${q('isActive')} = TRUE
				AND ${q('employee')}.${q('isArchived')} = FALSE
				AND ${q('employee')}.${q('deletedAt')} IS NULL`
			: '';

		await queryRunner.query(
			`UPDATE ${q('organization_project')}
			SET ${q('membersCount')} = (
				SELECT COUNT(*) FROM ${q('organization_project_employee')}
				${working}
				WHERE ${q('organization_project_employee')}.${q('organizationProjectId')} = ${q('organization_project')}.${q('id')}
			)`
		);
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
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
}

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
