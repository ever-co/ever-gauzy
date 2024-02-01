import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateTaskSizeTable1674538040466 implements MigrationInterface {

    name = 'CreateTaskSizeTable1674538040466';

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
        await queryRunner.query(`CREATE TABLE "task_size" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, CONSTRAINT "PK_a08ebf2a6737612dff6d587b82e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "task_size" ADD CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_ad6792b26526bd96ab18d634544"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_596512cc6508a482cc23ae6ab78"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_f6ec2207e50680a475d71c89793"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_size"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_size" RENAME TO "task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`ALTER TABLE "task_size" RENAME TO "temporary_task_size"`);
        await queryRunner.query(`CREATE TABLE "task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_size"`);
        await queryRunner.query(`DROP TABLE "temporary_task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
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
