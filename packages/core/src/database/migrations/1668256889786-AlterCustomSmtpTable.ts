
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCustomSmtpTable1668256889786 implements MigrationInterface {

    name = 'AlterCustomSmtpTable1668256889786';

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
        await queryRunner.query(`ALTER TABLE "custom_smtp" ADD "fromAddress" character varying`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "custom_smtp" DROP COLUMN "fromAddress"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_15a1306132d66c63ef31f7288c"`);
        await queryRunner.query(`DROP INDEX "IDX_2aa3fc8daa25beec4788d2be26"`);
        await queryRunner.query(`CREATE TABLE "temporary_custom_smtp" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "host" varchar NOT NULL, "port" integer NOT NULL, "secure" boolean NOT NULL, "username" varchar NOT NULL, "password" varchar NOT NULL, "isValidate" boolean NOT NULL DEFAULT (0), "fromAddress" varchar, CONSTRAINT "FK_15a1306132d66c63ef31f7288c1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2aa3fc8daa25beec4788d2be26c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_custom_smtp"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "host", "port", "secure", "username", "password", "isValidate") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "host", "port", "secure", "username", "password", "isValidate" FROM "custom_smtp"`);
        await queryRunner.query(`DROP TABLE "custom_smtp"`);
        await queryRunner.query(`ALTER TABLE "temporary_custom_smtp" RENAME TO "custom_smtp"`);
        await queryRunner.query(`CREATE INDEX "IDX_15a1306132d66c63ef31f7288c" ON "custom_smtp" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2aa3fc8daa25beec4788d2be26" ON "custom_smtp" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2aa3fc8daa25beec4788d2be26"`);
        await queryRunner.query(`DROP INDEX "IDX_15a1306132d66c63ef31f7288c"`);
        await queryRunner.query(`ALTER TABLE "custom_smtp" RENAME TO "temporary_custom_smtp"`);
        await queryRunner.query(`CREATE TABLE "custom_smtp" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "host" varchar NOT NULL, "port" integer NOT NULL, "secure" boolean NOT NULL, "username" varchar NOT NULL, "password" varchar NOT NULL, "isValidate" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_15a1306132d66c63ef31f7288c1" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2aa3fc8daa25beec4788d2be26c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "custom_smtp"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "host", "port", "secure", "username", "password", "isValidate") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "host", "port", "secure", "username", "password", "isValidate" FROM "temporary_custom_smtp"`);
        await queryRunner.query(`DROP TABLE "temporary_custom_smtp"`);
        await queryRunner.query(`CREATE INDEX "IDX_2aa3fc8daa25beec4788d2be26" ON "custom_smtp" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_15a1306132d66c63ef31f7288c" ON "custom_smtp" ("organizationId") `);
    }
}
