import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterTimesheetTable1661853087396 implements MigrationInterface {

    name = 'AlterTimesheetTable1661853087396';

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
        await queryRunner.query(`ALTER TABLE "timesheet" DROP CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623"`);
        await queryRunner.query(`ALTER TABLE "timesheet" ADD CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "timesheet" DROP CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623"`);
        await queryRunner.query(`ALTER TABLE "timesheet" ADD CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623" FOREIGN KEY ("approvedById") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_6c1f81934a3f597b3b1a17f562"`);
        await queryRunner.query(`DROP INDEX "IDX_8c8f821cb0fe0dd387491ea7d9"`);
        await queryRunner.query(`DROP INDEX "IDX_aca65a79fe0c1ec9e6a59022c5"`);
        await queryRunner.query(`DROP INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7"`);
        await queryRunner.query(`CREATE TABLE "temporary_timesheet" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime, "stoppedAt" datetime, "approvedAt" datetime, "submittedAt" datetime, "lockedAt" datetime, "isBilled" boolean NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('PENDING'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "approvedById" varchar, CONSTRAINT "FK_8c8f821cb0fe0dd387491ea7d9e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aca65a79fe0c1ec9e6a59022c54" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_25b8df69c9b7f5752c6a6a6ef7f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_timesheet"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById" FROM "timesheet"`);
        await queryRunner.query(`DROP TABLE "timesheet"`);
        await queryRunner.query(`ALTER TABLE "temporary_timesheet" RENAME TO "timesheet"`);
        await queryRunner.query(`CREATE INDEX "IDX_6c1f81934a3f597b3b1a17f562" ON "timesheet" ("approvedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c8f821cb0fe0dd387491ea7d9" ON "timesheet" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aca65a79fe0c1ec9e6a59022c5" ON "timesheet" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7" ON "timesheet" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_6c1f81934a3f597b3b1a17f562"`);
        await queryRunner.query(`DROP INDEX "IDX_8c8f821cb0fe0dd387491ea7d9"`);
        await queryRunner.query(`DROP INDEX "IDX_aca65a79fe0c1ec9e6a59022c5"`);
        await queryRunner.query(`DROP INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7"`);
        await queryRunner.query(`CREATE TABLE "temporary_timesheet" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime, "stoppedAt" datetime, "approvedAt" datetime, "submittedAt" datetime, "lockedAt" datetime, "isBilled" boolean NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('PENDING'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "approvedById" varchar, CONSTRAINT "FK_8c8f821cb0fe0dd387491ea7d9e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aca65a79fe0c1ec9e6a59022c54" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_25b8df69c9b7f5752c6a6a6ef7f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623" FOREIGN KEY ("approvedById") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_timesheet"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById" FROM "timesheet"`);
        await queryRunner.query(`DROP TABLE "timesheet"`);
        await queryRunner.query(`ALTER TABLE "temporary_timesheet" RENAME TO "timesheet"`);
        await queryRunner.query(`CREATE INDEX "IDX_6c1f81934a3f597b3b1a17f562" ON "timesheet" ("approvedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c8f821cb0fe0dd387491ea7d9" ON "timesheet" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aca65a79fe0c1ec9e6a59022c5" ON "timesheet" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7" ON "timesheet" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7"`);
        await queryRunner.query(`DROP INDEX "IDX_aca65a79fe0c1ec9e6a59022c5"`);
        await queryRunner.query(`DROP INDEX "IDX_8c8f821cb0fe0dd387491ea7d9"`);
        await queryRunner.query(`DROP INDEX "IDX_6c1f81934a3f597b3b1a17f562"`);
        await queryRunner.query(`ALTER TABLE "timesheet" RENAME TO "temporary_timesheet"`);
        await queryRunner.query(`CREATE TABLE "timesheet" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime, "stoppedAt" datetime, "approvedAt" datetime, "submittedAt" datetime, "lockedAt" datetime, "isBilled" boolean NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('PENDING'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "approvedById" varchar, CONSTRAINT "FK_8c8f821cb0fe0dd387491ea7d9e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aca65a79fe0c1ec9e6a59022c54" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_25b8df69c9b7f5752c6a6a6ef7f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "timesheet"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById" FROM "temporary_timesheet"`);
        await queryRunner.query(`DROP TABLE "temporary_timesheet"`);
        await queryRunner.query(`CREATE INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7" ON "timesheet" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aca65a79fe0c1ec9e6a59022c5" ON "timesheet" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c8f821cb0fe0dd387491ea7d9" ON "timesheet" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c1f81934a3f597b3b1a17f562" ON "timesheet" ("approvedById") `);
        await queryRunner.query(`DROP INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7"`);
        await queryRunner.query(`DROP INDEX "IDX_aca65a79fe0c1ec9e6a59022c5"`);
        await queryRunner.query(`DROP INDEX "IDX_8c8f821cb0fe0dd387491ea7d9"`);
        await queryRunner.query(`DROP INDEX "IDX_6c1f81934a3f597b3b1a17f562"`);
        await queryRunner.query(`ALTER TABLE "timesheet" RENAME TO "temporary_timesheet"`);
        await queryRunner.query(`CREATE TABLE "timesheet" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime, "stoppedAt" datetime, "approvedAt" datetime, "submittedAt" datetime, "lockedAt" datetime, "isBilled" boolean NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('PENDING'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "approvedById" varchar, CONSTRAINT "FK_6c1f81934a3f597b3b1a17f5623" FOREIGN KEY ("approvedById") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_8c8f821cb0fe0dd387491ea7d9e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_aca65a79fe0c1ec9e6a59022c54" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_25b8df69c9b7f5752c6a6a6ef7f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "timesheet"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "stoppedAt", "approvedAt", "submittedAt", "lockedAt", "isBilled", "status", "deletedAt", "employeeId", "approvedById" FROM "temporary_timesheet"`);
        await queryRunner.query(`DROP TABLE "temporary_timesheet"`);
        await queryRunner.query(`CREATE INDEX "IDX_25b8df69c9b7f5752c6a6a6ef7" ON "timesheet" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aca65a79fe0c1ec9e6a59022c5" ON "timesheet" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c8f821cb0fe0dd387491ea7d9" ON "timesheet" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c1f81934a3f597b3b1a17f562" ON "timesheet" ("approvedById") `);
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
