import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The tables whose rows the lists now read by `isArchived`. */
const TABLES = ['organization_project', 'organization_team'];

/**
 * Sets `isArchived = false` on every project and team row that holds no value.
 *
 * Projects and teams can now be archived, and every list of them (`GET /organization-projects`, `/pagination`,
 * `/count`, `/employee/:id`, `GET /organization-team`, `/me`, `/pagination`, `/count`, and the GraphQL fields)
 * reads the rows that are not archived unless the caller asks for archived ones, as `isArchived = false`. The
 * column is nullable (`BaseEntity`), and a row written with an explicit null would have dropped out of every list;
 * a null has never meant "archived", so it becomes `false`.
 *
 * Running it again changes nothing, and `down` changes nothing: which rows held a null is not recorded, and
 * `false` is what the column's default writes.
 */
export class NormalizeProjectAndTeamArchiveFlags1791000003440 implements MigrationInterface {
	name = 'NormalizeProjectAndTeamArchiveFlags1791000003440';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		const q = (identifier: string) => (dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`);

		for (const table of TABLES) {
			if (!(await queryRunner.hasTable(table)) || !(await queryRunner.hasColumn(table, 'isArchived'))) {
				continue;
			}
			// `FALSE` is a literal: Postgres, MySQL and SQLite (3.23+) all read it.
			await queryRunner.query(
				`UPDATE ${q(table)} SET ${q('isArchived')} = FALSE WHERE ${q('isArchived')} IS NULL`
			);
		}
	}

	public async down(): Promise<void> {
		console.log(chalk.gray(`${this.name}: nothing to revert, a null archive flag was never recorded.`));
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
