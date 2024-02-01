import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateTaskLinkedIssueTable1689150247379 implements MigrationInterface {

    name = 'CreateTaskLinkedIssueTable1689150247379';

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
        await queryRunner.query(`CREATE TABLE "task_linked_issues" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "action" integer NOT NULL, "taskFromId" uuid NOT NULL, "taskToId" uuid NOT NULL, CONSTRAINT "PK_7305665cc71cc7a48200e465608" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_20b50abc5c97610a75d49ad381" ON "task_linked_issues" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24114c4059e6b6991daba541b1" ON "task_linked_issues" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6deea7b3671e45973e191a1502" ON "task_linked_issues" ("taskFromId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0848fd2b8c23c0ab55146297cf" ON "task_linked_issues" ("taskToId") `);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_20b50abc5c97610a75d49ad3817" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_24114c4059e6b6991daba541b1d" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_6deea7b3671e45973e191a1502c" FOREIGN KEY ("taskFromId") REFERENCES "task"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_0848fd2b8c23c0ab55146297cff" FOREIGN KEY ("taskToId") REFERENCES "task"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_0848fd2b8c23c0ab55146297cff"`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_6deea7b3671e45973e191a1502c"`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_24114c4059e6b6991daba541b1d"`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_20b50abc5c97610a75d49ad3817"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0848fd2b8c23c0ab55146297cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6deea7b3671e45973e191a1502"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_24114c4059e6b6991daba541b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20b50abc5c97610a75d49ad381"`);
        await queryRunner.query(`DROP TABLE "task_linked_issues"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "task_linked_issues" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" integer NOT NULL, "taskFromId" varchar NOT NULL, "taskToId" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_20b50abc5c97610a75d49ad381" ON "task_linked_issues" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24114c4059e6b6991daba541b1" ON "task_linked_issues" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6deea7b3671e45973e191a1502" ON "task_linked_issues" ("taskFromId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0848fd2b8c23c0ab55146297cf" ON "task_linked_issues" ("taskToId") `);
        await queryRunner.query(`DROP INDEX "IDX_20b50abc5c97610a75d49ad381"`);
        await queryRunner.query(`DROP INDEX "IDX_24114c4059e6b6991daba541b1"`);
        await queryRunner.query(`DROP INDEX "IDX_6deea7b3671e45973e191a1502"`);
        await queryRunner.query(`DROP INDEX "IDX_0848fd2b8c23c0ab55146297cf"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_linked_issues" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" integer NOT NULL, "taskFromId" varchar NOT NULL, "taskToId" varchar NOT NULL, CONSTRAINT "FK_20b50abc5c97610a75d49ad3817" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_24114c4059e6b6991daba541b1d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6deea7b3671e45973e191a1502c" FOREIGN KEY ("taskFromId") REFERENCES "task" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_0848fd2b8c23c0ab55146297cff" FOREIGN KEY ("taskToId") REFERENCES "task" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_linked_issues"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "taskFromId", "taskToId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "taskFromId", "taskToId" FROM "task_linked_issues"`);
        await queryRunner.query(`DROP TABLE "task_linked_issues"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_linked_issues" RENAME TO "task_linked_issues"`);
        await queryRunner.query(`CREATE INDEX "IDX_20b50abc5c97610a75d49ad381" ON "task_linked_issues" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24114c4059e6b6991daba541b1" ON "task_linked_issues" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6deea7b3671e45973e191a1502" ON "task_linked_issues" ("taskFromId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0848fd2b8c23c0ab55146297cf" ON "task_linked_issues" ("taskToId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0848fd2b8c23c0ab55146297cf"`);
        await queryRunner.query(`DROP INDEX "IDX_6deea7b3671e45973e191a1502"`);
        await queryRunner.query(`DROP INDEX "IDX_24114c4059e6b6991daba541b1"`);
        await queryRunner.query(`DROP INDEX "IDX_20b50abc5c97610a75d49ad381"`);
        await queryRunner.query(`ALTER TABLE "task_linked_issues" RENAME TO "temporary_task_linked_issues"`);
        await queryRunner.query(`CREATE TABLE "task_linked_issues" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" integer NOT NULL, "taskFromId" varchar NOT NULL, "taskToId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "task_linked_issues"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "taskFromId", "taskToId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "taskFromId", "taskToId" FROM "temporary_task_linked_issues"`);
        await queryRunner.query(`DROP TABLE "temporary_task_linked_issues"`);
        await queryRunner.query(`CREATE INDEX "IDX_0848fd2b8c23c0ab55146297cf" ON "task_linked_issues" ("taskToId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6deea7b3671e45973e191a1502" ON "task_linked_issues" ("taskFromId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24114c4059e6b6991daba541b1" ON "task_linked_issues" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20b50abc5c97610a75d49ad381" ON "task_linked_issues" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_0848fd2b8c23c0ab55146297cf"`);
        await queryRunner.query(`DROP INDEX "IDX_6deea7b3671e45973e191a1502"`);
        await queryRunner.query(`DROP INDEX "IDX_24114c4059e6b6991daba541b1"`);
        await queryRunner.query(`DROP INDEX "IDX_20b50abc5c97610a75d49ad381"`);
        await queryRunner.query(`DROP TABLE "task_linked_issues"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
