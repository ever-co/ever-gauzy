import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `tag_time_log`, the tags a time log is filed under (ever-co/ever-gauzy#12029).
 *
 * A time log was declared taggable and the manual-time body took a `tags` list, yet nothing stored it: the time could
 * be sorted by project and task only, never by the kind of work. One row links one log to one tag, named like
 * `tag_task`, with both columns as its key and an index on each. Deleting a log or a tag deletes its rows; the other
 * side stays. The constraint names are the ones TypeORM gives the `TimeLog.tags` relation, and they are declared in
 * the table itself, so an up that runs again changes nothing.
 *
 * Down drops the table: the logs lose their tags and nothing else.
 */
export class CreateTagTimeLogTable1791000019250 implements MigrationInterface {
	name = 'CreateTagTimeLogTable1791000019250';

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
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
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
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			'CREATE TABLE IF NOT EXISTS "tag_time_log" (' +
				'"timeLogId" uuid NOT NULL, "tagId" uuid NOT NULL, ' +
				'CONSTRAINT "PK_aa530786c64221c14ec546d3e8e" PRIMARY KEY ("timeLogId", "tagId"), ' +
				'CONSTRAINT "FK_c7f36c5683f65febab3d7037278" FOREIGN KEY ("timeLogId") REFERENCES "time_log"("id") ' +
				'ON DELETE CASCADE ON UPDATE CASCADE, ' +
				'CONSTRAINT "FK_a04c5b195f624cc71a37e494043" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ' +
				'ON DELETE CASCADE ON UPDATE CASCADE)'
		);
		await queryRunner.query(
			'CREATE INDEX IF NOT EXISTS "IDX_c7f36c5683f65febab3d703727" ON "tag_time_log" ("timeLogId")'
		);
		await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_a04c5b195f624cc71a37e49404" ON "tag_time_log" ("tagId")');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('DROP TABLE IF EXISTS "tag_time_log"');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			'CREATE TABLE IF NOT EXISTS "tag_time_log" (' +
				'"timeLogId" varchar NOT NULL, "tagId" varchar NOT NULL, ' +
				'CONSTRAINT "FK_c7f36c5683f65febab3d7037278" FOREIGN KEY ("timeLogId") REFERENCES "time_log" ("id") ' +
				'ON DELETE CASCADE ON UPDATE CASCADE, ' +
				'CONSTRAINT "FK_a04c5b195f624cc71a37e494043" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ' +
				'ON DELETE CASCADE ON UPDATE CASCADE, ' +
				'PRIMARY KEY ("timeLogId", "tagId"))'
		);
		await queryRunner.query(
			'CREATE INDEX IF NOT EXISTS "IDX_c7f36c5683f65febab3d703727" ON "tag_time_log" ("timeLogId")'
		);
		await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_a04c5b195f624cc71a37e49404" ON "tag_time_log" ("tagId")');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('DROP INDEX IF EXISTS "IDX_a04c5b195f624cc71a37e49404"');
		await queryRunner.query('DROP INDEX IF EXISTS "IDX_c7f36c5683f65febab3d703727"');
		await queryRunner.query('DROP TABLE IF EXISTS "tag_time_log"');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			'CREATE TABLE IF NOT EXISTS `tag_time_log` (' +
				'`timeLogId` varchar(36) NOT NULL, `tagId` varchar(36) NOT NULL, ' +
				'INDEX `IDX_c7f36c5683f65febab3d703727` (`timeLogId`), ' +
				'INDEX `IDX_a04c5b195f624cc71a37e49404` (`tagId`), ' +
				'PRIMARY KEY (`timeLogId`, `tagId`), ' +
				'CONSTRAINT `FK_c7f36c5683f65febab3d7037278` FOREIGN KEY (`timeLogId`) REFERENCES `time_log`(`id`) ' +
				'ON DELETE CASCADE ON UPDATE CASCADE, ' +
				'CONSTRAINT `FK_a04c5b195f624cc71a37e494043` FOREIGN KEY (`tagId`) REFERENCES `tag`(`id`) ' +
				'ON DELETE CASCADE ON UPDATE CASCADE) ENGINE=InnoDB'
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('DROP TABLE IF EXISTS `tag_time_log`');
	}
}
