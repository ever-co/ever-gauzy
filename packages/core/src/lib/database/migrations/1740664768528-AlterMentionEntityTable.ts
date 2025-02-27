import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterMentionEntityTable1740664768528 implements MigrationInterface {
	name = 'AlterMentionEntityTable1740664768528';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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
		switch (queryRunner.connection.options.type) {
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
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_16a2deee0d7ea361950eed1b944"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_34b0087a30379c86b470a4298ca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionedUserId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionById"`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "actorType" integer`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionedEmployeeId" uuid NOT NULL`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "employeeId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_8a71b1017f6ea51d1913adcae4" ON "mention" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_a123435acf8d70e5df978e759f" ON "mention" ("mentionedEmployeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_465f1a9281f338ae38cc961c2a" ON "mention" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_a123435acf8d70e5df978e759f9" FOREIGN KEY ("mentionedEmployeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_465f1a9281f338ae38cc961c2a5" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_465f1a9281f338ae38cc961c2a5"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_a123435acf8d70e5df978e759f9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_465f1a9281f338ae38cc961c2a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a123435acf8d70e5df978e759f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a71b1017f6ea51d1913adcae4"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionedEmployeeId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionById" uuid NOT NULL`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionedUserId" uuid NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
