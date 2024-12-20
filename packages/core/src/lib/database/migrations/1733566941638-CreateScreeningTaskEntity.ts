import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateScreeningTaskEntity1733566941638 implements MigrationInterface {
	name = 'CreateScreeningTaskEntity1733566941638';

	/**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
        await queryRunner.query(`CREATE TABLE "screening_task" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "status" character varying NOT NULL, "onHoldUntil" TIMESTAMP, "taskId" uuid NOT NULL, "creatorId" uuid, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "PK_3fa27247b56e45e76f7d89eaffc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
        await queryRunner.query(`ALTER TABLE "task" ADD "isScreeningTask" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_b7864d01ba77b2d964487799252" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_b7864d01ba77b2d964487799252"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_1a12e2142255ff971543d67909a"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "isScreeningTask"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7864d01ba77b2d96448779925"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f389fca5d5348dfeb573edba8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_67c4061374b0972628f99e7eff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ec254a71f5c139937772d6b5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a12e2142255ff971543d67909"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_883f6cb113b97044ecfc1007f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7302b47755509285f3a3cadfb2"`);
        await queryRunner.query(`DROP TABLE "screening_task"`);
    }

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {

	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {

	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

	}
}
