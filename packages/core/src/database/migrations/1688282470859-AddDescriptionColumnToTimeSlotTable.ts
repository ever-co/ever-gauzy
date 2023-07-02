
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDescriptionColumnToTimeSlotTable1688282470859 implements MigrationInterface {

    name = 'AddDescriptionColumnToTimeSlotTable1688282470859';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteDownQueryRunner(queryRunner);
        } else {
            await this.postgresDownQueryRunner(queryRunner);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_slot" ADD "description" character varying`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "description"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7913305b850c7afc89b6ed96a3"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e7d1075bfd97eea6643b1479"`);
        await queryRunner.query(`DROP INDEX "IDX_f44e721669d5c6bed32cd6a3bf"`);
        await queryRunner.query(`DROP INDEX "IDX_0c707825a7c2ecc4e186b07ebf"`);
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`CREATE TABLE "temporary_time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, "description" varchar, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "time_slot"`);
        await queryRunner.query(`DROP TABLE "time_slot"`);
        await queryRunner.query(`ALTER TABLE "temporary_time_slot" RENAME TO "time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
        await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
        await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
        await queryRunner.query(`DROP INDEX "IDX_0c707825a7c2ecc4e186b07ebf"`);
        await queryRunner.query(`DROP INDEX "IDX_f44e721669d5c6bed32cd6a3bf"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e7d1075bfd97eea6643b1479"`);
        await queryRunner.query(`DROP INDEX "IDX_7913305b850c7afc89b6ed96a3"`);
        await queryRunner.query(`ALTER TABLE "time_slot" RENAME TO "temporary_time_slot"`);
        await queryRunner.query(`CREATE TABLE "time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId" FROM "temporary_time_slot"`);
        await queryRunner.query(`DROP TABLE "temporary_time_slot"`);
        await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
        await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
    }
}
