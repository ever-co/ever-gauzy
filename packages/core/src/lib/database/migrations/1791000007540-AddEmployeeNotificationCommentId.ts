import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'employee_notification';
const COLUMN = 'commentId';

/** The column on each database, as TypeORM creates it for the entity (a nullable uuid, no foreign key). */
const DEFINITION: Record<Dialect, string> = {
	postgres: 'uuid',
	sqlite: 'varchar',
	mysql: 'varchar(36) NULL'
};

/**
 * Adds `employee_notification.commentId`: the comment a notification is about, when it is about one (a comment on a
 * record the receiver follows). The record stays in `entity` / `entityId`, so every reader of a notification keeps
 * opening the record; the Inbox files such a notification as an entry about the comment (entity `Comment`, the record
 * in its metadata), the shape the Inbox already gives a task comment, so a client opens the thread.
 *
 * Safe on a live database: one nullable column, no default, no index, no backfill (a notification filed before names
 * no comment, as before). Guarded (`IF NOT EXISTS` on Postgres, a column check elsewhere), so running `up` twice is
 * harmless. `down` drops the column (SQLite keeps it: the embedded dialect keeps its additive columns).
 */
export class AddEmployeeNotificationCommentId1791000007540 implements MigrationInterface {
	name = 'AddEmployeeNotificationCommentId1791000007540';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) {
			console.log(chalk.gray(`${this.name}: no ${TABLE} table, nothing to do.`));
			return;
		}
		if (dialect === 'postgres') {
			await queryRunner.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${COLUMN}" ${DEFINITION.postgres}`);
			return;
		}
		if (await queryRunner.hasColumn(TABLE, COLUMN)) {
			return;
		}
		await queryRunner.query(`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${quoted(dialect, COLUMN)} ${DEFINITION[dialect]}`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) {
			return;
		}
		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${COLUMN}"`);
				break;
			case 'mysql':
				if (await queryRunner.hasColumn(TABLE, COLUMN)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${COLUMN}\``);
				}
				break;
			default:
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
		}
	}
}

/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
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

/** An identifier quoted for the dialect. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
