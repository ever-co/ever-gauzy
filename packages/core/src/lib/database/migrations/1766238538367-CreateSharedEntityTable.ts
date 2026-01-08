import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSharedEntityTable1766238538367 implements MigrationInterface {
    name = 'CreateSharedEntityTable1766238538367';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
        await queryRunner.query(`CREATE TABLE "shared_entity" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "token" character varying NOT NULL, "shareRules" jsonb NOT NULL, "sharedOptions" jsonb, CONSTRAINT "PK_44a2e8c95ee195f69dd609e047c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_06ea1a5c01e60e4531cc01282b" ON "shared_entity" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fcac8f30b4e1667ec54636bc0" ON "shared_entity" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_08aabe353224b3f7a2c7e155e1" ON "shared_entity" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a931296bdb7f0338305e3a1137" ON "shared_entity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_35fd94ade1346711708d605163" ON "shared_entity" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_16c97b224c3592dd589f0dff38" ON "shared_entity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_87232c0df1129aaee40a1de44a" ON "shared_entity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058d62fe782629c042c001ce01" ON "shared_entity" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ab400c535c429eb65ad022e2" ON "shared_entity" ("entityId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_efb101ff13d467e233a66f48e8" ON "shared_entity" ("token") `);
        await queryRunner.query(`ALTER TABLE "shared_entity" ADD CONSTRAINT "FK_06ea1a5c01e60e4531cc01282b5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shared_entity" ADD CONSTRAINT "FK_9fcac8f30b4e1667ec54636bc01" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shared_entity" ADD CONSTRAINT "FK_08aabe353224b3f7a2c7e155e14" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shared_entity" ADD CONSTRAINT "FK_16c97b224c3592dd589f0dff381" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shared_entity" ADD CONSTRAINT "FK_87232c0df1129aaee40a1de44a2" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "shared_entity" DROP CONSTRAINT "FK_87232c0df1129aaee40a1de44a2"`);
        await queryRunner.query(`ALTER TABLE "shared_entity" DROP CONSTRAINT "FK_16c97b224c3592dd589f0dff381"`);
        await queryRunner.query(`ALTER TABLE "shared_entity" DROP CONSTRAINT "FK_08aabe353224b3f7a2c7e155e14"`);
        await queryRunner.query(`ALTER TABLE "shared_entity" DROP CONSTRAINT "FK_9fcac8f30b4e1667ec54636bc01"`);
        await queryRunner.query(`ALTER TABLE "shared_entity" DROP CONSTRAINT "FK_06ea1a5c01e60e4531cc01282b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_efb101ff13d467e233a66f48e8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8ab400c535c429eb65ad022e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_058d62fe782629c042c001ce01"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87232c0df1129aaee40a1de44a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16c97b224c3592dd589f0dff38"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_35fd94ade1346711708d605163"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a931296bdb7f0338305e3a1137"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08aabe353224b3f7a2c7e155e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9fcac8f30b4e1667ec54636bc0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06ea1a5c01e60e4531cc01282b"`);
        await queryRunner.query(`DROP TABLE "shared_entity"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "shared_entity" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "token" varchar NOT NULL, "shareRules" text NOT NULL, "sharedOptions" text)`);
        await queryRunner.query(`CREATE INDEX "IDX_06ea1a5c01e60e4531cc01282b" ON "shared_entity" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fcac8f30b4e1667ec54636bc0" ON "shared_entity" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_08aabe353224b3f7a2c7e155e1" ON "shared_entity" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a931296bdb7f0338305e3a1137" ON "shared_entity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_35fd94ade1346711708d605163" ON "shared_entity" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_16c97b224c3592dd589f0dff38" ON "shared_entity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_87232c0df1129aaee40a1de44a" ON "shared_entity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058d62fe782629c042c001ce01" ON "shared_entity" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ab400c535c429eb65ad022e2" ON "shared_entity" ("entityId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_efb101ff13d467e233a66f48e8" ON "shared_entity" ("token") `);
        await queryRunner.query(`DROP INDEX "IDX_06ea1a5c01e60e4531cc01282b"`);
        await queryRunner.query(`DROP INDEX "IDX_9fcac8f30b4e1667ec54636bc0"`);
        await queryRunner.query(`DROP INDEX "IDX_08aabe353224b3f7a2c7e155e1"`);
        await queryRunner.query(`DROP INDEX "IDX_a931296bdb7f0338305e3a1137"`);
        await queryRunner.query(`DROP INDEX "IDX_35fd94ade1346711708d605163"`);
        await queryRunner.query(`DROP INDEX "IDX_16c97b224c3592dd589f0dff38"`);
        await queryRunner.query(`DROP INDEX "IDX_87232c0df1129aaee40a1de44a"`);
        await queryRunner.query(`DROP INDEX "IDX_058d62fe782629c042c001ce01"`);
        await queryRunner.query(`DROP INDEX "IDX_e8ab400c535c429eb65ad022e2"`);
        await queryRunner.query(`DROP INDEX "IDX_efb101ff13d467e233a66f48e8"`);
        await queryRunner.query(`CREATE TABLE "temporary_shared_entity" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "token" varchar NOT NULL, "shareRules" text NOT NULL, "sharedOptions" text, CONSTRAINT "FK_06ea1a5c01e60e4531cc01282b5" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9fcac8f30b4e1667ec54636bc01" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_08aabe353224b3f7a2c7e155e14" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16c97b224c3592dd589f0dff381" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_87232c0df1129aaee40a1de44a2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_shared_entity"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "token", "shareRules", "sharedOptions") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "token", "shareRules", "sharedOptions" FROM "shared_entity"`);
        await queryRunner.query(`DROP TABLE "shared_entity"`);
        await queryRunner.query(`ALTER TABLE "temporary_shared_entity" RENAME TO "shared_entity"`);
        await queryRunner.query(`CREATE INDEX "IDX_06ea1a5c01e60e4531cc01282b" ON "shared_entity" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fcac8f30b4e1667ec54636bc0" ON "shared_entity" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_08aabe353224b3f7a2c7e155e1" ON "shared_entity" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a931296bdb7f0338305e3a1137" ON "shared_entity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_35fd94ade1346711708d605163" ON "shared_entity" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_16c97b224c3592dd589f0dff38" ON "shared_entity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_87232c0df1129aaee40a1de44a" ON "shared_entity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058d62fe782629c042c001ce01" ON "shared_entity" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ab400c535c429eb65ad022e2" ON "shared_entity" ("entityId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_efb101ff13d467e233a66f48e8" ON "shared_entity" ("token") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_efb101ff13d467e233a66f48e8"`);
        await queryRunner.query(`DROP INDEX "IDX_e8ab400c535c429eb65ad022e2"`);
        await queryRunner.query(`DROP INDEX "IDX_058d62fe782629c042c001ce01"`);
        await queryRunner.query(`DROP INDEX "IDX_87232c0df1129aaee40a1de44a"`);
        await queryRunner.query(`DROP INDEX "IDX_16c97b224c3592dd589f0dff38"`);
        await queryRunner.query(`DROP INDEX "IDX_35fd94ade1346711708d605163"`);
        await queryRunner.query(`DROP INDEX "IDX_a931296bdb7f0338305e3a1137"`);
        await queryRunner.query(`DROP INDEX "IDX_08aabe353224b3f7a2c7e155e1"`);
        await queryRunner.query(`DROP INDEX "IDX_9fcac8f30b4e1667ec54636bc0"`);
        await queryRunner.query(`DROP INDEX "IDX_06ea1a5c01e60e4531cc01282b"`);
        await queryRunner.query(`ALTER TABLE "shared_entity" RENAME TO "temporary_shared_entity"`);
        await queryRunner.query(`CREATE TABLE "shared_entity" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "token" varchar NOT NULL, "shareRules" text NOT NULL, "sharedOptions" text)`);
        await queryRunner.query(`INSERT INTO "shared_entity"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "token", "shareRules", "sharedOptions") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "token", "shareRules", "sharedOptions" FROM "temporary_shared_entity"`);
        await queryRunner.query(`DROP TABLE "temporary_shared_entity"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_efb101ff13d467e233a66f48e8" ON "shared_entity" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ab400c535c429eb65ad022e2" ON "shared_entity" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058d62fe782629c042c001ce01" ON "shared_entity" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_87232c0df1129aaee40a1de44a" ON "shared_entity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16c97b224c3592dd589f0dff38" ON "shared_entity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35fd94ade1346711708d605163" ON "shared_entity" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_a931296bdb7f0338305e3a1137" ON "shared_entity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_08aabe353224b3f7a2c7e155e1" ON "shared_entity" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9fcac8f30b4e1667ec54636bc0" ON "shared_entity" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_06ea1a5c01e60e4531cc01282b" ON "shared_entity" ("createdByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_efb101ff13d467e233a66f48e8"`);
        await queryRunner.query(`DROP INDEX "IDX_e8ab400c535c429eb65ad022e2"`);
        await queryRunner.query(`DROP INDEX "IDX_058d62fe782629c042c001ce01"`);
        await queryRunner.query(`DROP INDEX "IDX_87232c0df1129aaee40a1de44a"`);
        await queryRunner.query(`DROP INDEX "IDX_16c97b224c3592dd589f0dff38"`);
        await queryRunner.query(`DROP INDEX "IDX_35fd94ade1346711708d605163"`);
        await queryRunner.query(`DROP INDEX "IDX_a931296bdb7f0338305e3a1137"`);
        await queryRunner.query(`DROP INDEX "IDX_08aabe353224b3f7a2c7e155e1"`);
        await queryRunner.query(`DROP INDEX "IDX_9fcac8f30b4e1667ec54636bc0"`);
        await queryRunner.query(`DROP INDEX "IDX_06ea1a5c01e60e4531cc01282b"`);
        await queryRunner.query(`DROP TABLE "shared_entity"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`shared_entity\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`token\` varchar(255) NOT NULL, \`shareRules\` json NOT NULL, \`sharedOptions\` json NULL, INDEX \`IDX_06ea1a5c01e60e4531cc01282b\` (\`createdByUserId\`), INDEX \`IDX_9fcac8f30b4e1667ec54636bc0\` (\`updatedByUserId\`), INDEX \`IDX_08aabe353224b3f7a2c7e155e1\` (\`deletedByUserId\`), INDEX \`IDX_a931296bdb7f0338305e3a1137\` (\`isActive\`), INDEX \`IDX_35fd94ade1346711708d605163\` (\`isArchived\`), INDEX \`IDX_16c97b224c3592dd589f0dff38\` (\`tenantId\`), INDEX \`IDX_87232c0df1129aaee40a1de44a\` (\`organizationId\`), INDEX \`IDX_058d62fe782629c042c001ce01\` (\`entity\`), INDEX \`IDX_e8ab400c535c429eb65ad022e2\` (\`entityId\`), UNIQUE INDEX \`IDX_efb101ff13d467e233a66f48e8\` (\`token\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` ADD CONSTRAINT \`FK_06ea1a5c01e60e4531cc01282b5\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` ADD CONSTRAINT \`FK_9fcac8f30b4e1667ec54636bc01\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` ADD CONSTRAINT \`FK_08aabe353224b3f7a2c7e155e14\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` ADD CONSTRAINT \`FK_16c97b224c3592dd589f0dff381\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` ADD CONSTRAINT \`FK_87232c0df1129aaee40a1de44a2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`shared_entity\` DROP FOREIGN KEY \`FK_87232c0df1129aaee40a1de44a2\``);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` DROP FOREIGN KEY \`FK_16c97b224c3592dd589f0dff381\``);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` DROP FOREIGN KEY \`FK_08aabe353224b3f7a2c7e155e14\``);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` DROP FOREIGN KEY \`FK_9fcac8f30b4e1667ec54636bc01\``);
        await queryRunner.query(`ALTER TABLE \`shared_entity\` DROP FOREIGN KEY \`FK_06ea1a5c01e60e4531cc01282b5\``);
        await queryRunner.query(`DROP INDEX \`IDX_efb101ff13d467e233a66f48e8\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_e8ab400c535c429eb65ad022e2\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_058d62fe782629c042c001ce01\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_87232c0df1129aaee40a1de44a\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_16c97b224c3592dd589f0dff38\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_35fd94ade1346711708d605163\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_a931296bdb7f0338305e3a1137\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_08aabe353224b3f7a2c7e155e1\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_9fcac8f30b4e1667ec54636bc0\` ON \`shared_entity\``);
        await queryRunner.query(`DROP INDEX \`IDX_06ea1a5c01e60e4531cc01282b\` ON \`shared_entity\``);
        await queryRunner.query(`DROP TABLE \`shared_entity\``);
    }
}
