import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateBroadcastTable1768390359375 implements MigrationInterface {
    name = 'CreateBroadcastTable1768390359375';

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
        await queryRunner.query(`CREATE TABLE "broadcast" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "title" character varying NOT NULL, "content" jsonb NOT NULL, "category" character varying NOT NULL, "visibilityMode" character varying NOT NULL, "audienceRules" jsonb, "publishedAt" TIMESTAMP, "employeeId" uuid, CONSTRAINT "PK_0ded4e27b42c4b2589e70095aa9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb" ON "broadcast" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47bc59cf349434e04e9448f3ef" ON "broadcast" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b511fa9568f1acacae0241f9e6" ON "broadcast" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6198c2b3cf1f868ae9f69b202e" ON "broadcast" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5b3d80e1005ca9d82ab577338" ON "broadcast" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c996b4cdf8236910fd9e18005" ON "broadcast" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ed8c836fac026bf6f1431246de" ON "broadcast" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b930d7578dd832187c44c24bd6" ON "broadcast" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_354c4da2b48a36b06f65651a5e" ON "broadcast" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5db346677d4d8f6e7b27bf475e" ON "broadcast" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3" ON "broadcast" ("visibilityMode") `);
        await queryRunner.query(`CREATE INDEX "IDX_65274ebe8c704c12ae9c7a4dab" ON "broadcast" ("publishedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1587283393ae3e01f547fe7dc" ON "broadcast" ("employeeId") `);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_6e01fb5c3ce6fbfe8fa38cf1bbd" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_47bc59cf349434e04e9448f3ef2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_b511fa9568f1acacae0241f9e6a" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_9c996b4cdf8236910fd9e180054" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_ed8c836fac026bf6f1431246de5" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "broadcast" ADD CONSTRAINT "FK_a1587283393ae3e01f547fe7dca" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_a1587283393ae3e01f547fe7dca"`);
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_ed8c836fac026bf6f1431246de5"`);
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_9c996b4cdf8236910fd9e180054"`);
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_b511fa9568f1acacae0241f9e6a"`);
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_47bc59cf349434e04e9448f3ef2"`);
        await queryRunner.query(`ALTER TABLE "broadcast" DROP CONSTRAINT "FK_6e01fb5c3ce6fbfe8fa38cf1bbd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1587283393ae3e01f547fe7dc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_65274ebe8c704c12ae9c7a4dab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1cd9bdb332d577cfc8bb9a91b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5db346677d4d8f6e7b27bf475e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_354c4da2b48a36b06f65651a5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b930d7578dd832187c44c24bd6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ed8c836fac026bf6f1431246de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c996b4cdf8236910fd9e18005"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b5b3d80e1005ca9d82ab577338"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6198c2b3cf1f868ae9f69b202e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b511fa9568f1acacae0241f9e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47bc59cf349434e04e9448f3ef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6e01fb5c3ce6fbfe8fa38cf1bb"`);
        await queryRunner.query(`DROP TABLE "broadcast"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "broadcast" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "content" text NOT NULL, "category" varchar NOT NULL, "visibilityMode" varchar NOT NULL, "audienceRules" text, "publishedAt" datetime, "employeeId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb" ON "broadcast" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47bc59cf349434e04e9448f3ef" ON "broadcast" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b511fa9568f1acacae0241f9e6" ON "broadcast" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6198c2b3cf1f868ae9f69b202e" ON "broadcast" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5b3d80e1005ca9d82ab577338" ON "broadcast" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c996b4cdf8236910fd9e18005" ON "broadcast" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ed8c836fac026bf6f1431246de" ON "broadcast" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b930d7578dd832187c44c24bd6" ON "broadcast" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_354c4da2b48a36b06f65651a5e" ON "broadcast" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5db346677d4d8f6e7b27bf475e" ON "broadcast" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3" ON "broadcast" ("visibilityMode") `);
        await queryRunner.query(`CREATE INDEX "IDX_65274ebe8c704c12ae9c7a4dab" ON "broadcast" ("publishedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1587283393ae3e01f547fe7dc" ON "broadcast" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb"`);
        await queryRunner.query(`DROP INDEX "IDX_47bc59cf349434e04e9448f3ef"`);
        await queryRunner.query(`DROP INDEX "IDX_b511fa9568f1acacae0241f9e6"`);
        await queryRunner.query(`DROP INDEX "IDX_6198c2b3cf1f868ae9f69b202e"`);
        await queryRunner.query(`DROP INDEX "IDX_b5b3d80e1005ca9d82ab577338"`);
        await queryRunner.query(`DROP INDEX "IDX_9c996b4cdf8236910fd9e18005"`);
        await queryRunner.query(`DROP INDEX "IDX_ed8c836fac026bf6f1431246de"`);
        await queryRunner.query(`DROP INDEX "IDX_b930d7578dd832187c44c24bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_354c4da2b48a36b06f65651a5e"`);
        await queryRunner.query(`DROP INDEX "IDX_5db346677d4d8f6e7b27bf475e"`);
        await queryRunner.query(`DROP INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3"`);
        await queryRunner.query(`DROP INDEX "IDX_65274ebe8c704c12ae9c7a4dab"`);
        await queryRunner.query(`DROP INDEX "IDX_a1587283393ae3e01f547fe7dc"`);
        await queryRunner.query(`CREATE TABLE "temporary_broadcast" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "content" text NOT NULL, "category" varchar NOT NULL, "visibilityMode" varchar NOT NULL, "audienceRules" text, "publishedAt" datetime, "employeeId" varchar, CONSTRAINT "FK_6e01fb5c3ce6fbfe8fa38cf1bbd" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_47bc59cf349434e04e9448f3ef2" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b511fa9568f1acacae0241f9e6a" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9c996b4cdf8236910fd9e180054" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ed8c836fac026bf6f1431246de5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a1587283393ae3e01f547fe7dca" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_broadcast"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "content", "category", "visibilityMode", "audienceRules", "publishedAt", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "content", "category", "visibilityMode", "audienceRules", "publishedAt", "employeeId" FROM "broadcast"`);
        await queryRunner.query(`DROP TABLE "broadcast"`);
        await queryRunner.query(`ALTER TABLE "temporary_broadcast" RENAME TO "broadcast"`);
        await queryRunner.query(`CREATE INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb" ON "broadcast" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47bc59cf349434e04e9448f3ef" ON "broadcast" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b511fa9568f1acacae0241f9e6" ON "broadcast" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6198c2b3cf1f868ae9f69b202e" ON "broadcast" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5b3d80e1005ca9d82ab577338" ON "broadcast" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c996b4cdf8236910fd9e18005" ON "broadcast" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ed8c836fac026bf6f1431246de" ON "broadcast" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b930d7578dd832187c44c24bd6" ON "broadcast" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_354c4da2b48a36b06f65651a5e" ON "broadcast" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5db346677d4d8f6e7b27bf475e" ON "broadcast" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3" ON "broadcast" ("visibilityMode") `);
        await queryRunner.query(`CREATE INDEX "IDX_65274ebe8c704c12ae9c7a4dab" ON "broadcast" ("publishedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1587283393ae3e01f547fe7dc" ON "broadcast" ("employeeId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_a1587283393ae3e01f547fe7dc"`);
        await queryRunner.query(`DROP INDEX "IDX_65274ebe8c704c12ae9c7a4dab"`);
        await queryRunner.query(`DROP INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3"`);
        await queryRunner.query(`DROP INDEX "IDX_5db346677d4d8f6e7b27bf475e"`);
        await queryRunner.query(`DROP INDEX "IDX_354c4da2b48a36b06f65651a5e"`);
        await queryRunner.query(`DROP INDEX "IDX_b930d7578dd832187c44c24bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_ed8c836fac026bf6f1431246de"`);
        await queryRunner.query(`DROP INDEX "IDX_9c996b4cdf8236910fd9e18005"`);
        await queryRunner.query(`DROP INDEX "IDX_b5b3d80e1005ca9d82ab577338"`);
        await queryRunner.query(`DROP INDEX "IDX_6198c2b3cf1f868ae9f69b202e"`);
        await queryRunner.query(`DROP INDEX "IDX_b511fa9568f1acacae0241f9e6"`);
        await queryRunner.query(`DROP INDEX "IDX_47bc59cf349434e04e9448f3ef"`);
        await queryRunner.query(`DROP INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb"`);
        await queryRunner.query(`ALTER TABLE "broadcast" RENAME TO "temporary_broadcast"`);
        await queryRunner.query(`CREATE TABLE "broadcast" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "content" text NOT NULL, "category" varchar NOT NULL, "visibilityMode" varchar NOT NULL, "audienceRules" text, "publishedAt" datetime, "employeeId" varchar)`);
        await queryRunner.query(`INSERT INTO "broadcast"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "content", "category", "visibilityMode", "audienceRules", "publishedAt", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "content", "category", "visibilityMode", "audienceRules", "publishedAt", "employeeId" FROM "temporary_broadcast"`);
        await queryRunner.query(`DROP TABLE "temporary_broadcast"`);
        await queryRunner.query(`CREATE INDEX "IDX_a1587283393ae3e01f547fe7dc" ON "broadcast" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_65274ebe8c704c12ae9c7a4dab" ON "broadcast" ("publishedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3" ON "broadcast" ("visibilityMode") `);
        await queryRunner.query(`CREATE INDEX "IDX_5db346677d4d8f6e7b27bf475e" ON "broadcast" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_354c4da2b48a36b06f65651a5e" ON "broadcast" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b930d7578dd832187c44c24bd6" ON "broadcast" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_ed8c836fac026bf6f1431246de" ON "broadcast" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c996b4cdf8236910fd9e18005" ON "broadcast" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5b3d80e1005ca9d82ab577338" ON "broadcast" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6198c2b3cf1f868ae9f69b202e" ON "broadcast" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b511fa9568f1acacae0241f9e6" ON "broadcast" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_47bc59cf349434e04e9448f3ef" ON "broadcast" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb" ON "broadcast" ("createdByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_a1587283393ae3e01f547fe7dc"`);
        await queryRunner.query(`DROP INDEX "IDX_65274ebe8c704c12ae9c7a4dab"`);
        await queryRunner.query(`DROP INDEX "IDX_1cd9bdb332d577cfc8bb9a91b3"`);
        await queryRunner.query(`DROP INDEX "IDX_5db346677d4d8f6e7b27bf475e"`);
        await queryRunner.query(`DROP INDEX "IDX_354c4da2b48a36b06f65651a5e"`);
        await queryRunner.query(`DROP INDEX "IDX_b930d7578dd832187c44c24bd6"`);
        await queryRunner.query(`DROP INDEX "IDX_ed8c836fac026bf6f1431246de"`);
        await queryRunner.query(`DROP INDEX "IDX_9c996b4cdf8236910fd9e18005"`);
        await queryRunner.query(`DROP INDEX "IDX_b5b3d80e1005ca9d82ab577338"`);
        await queryRunner.query(`DROP INDEX "IDX_6198c2b3cf1f868ae9f69b202e"`);
        await queryRunner.query(`DROP INDEX "IDX_b511fa9568f1acacae0241f9e6"`);
        await queryRunner.query(`DROP INDEX "IDX_47bc59cf349434e04e9448f3ef"`);
        await queryRunner.query(`DROP INDEX "IDX_6e01fb5c3ce6fbfe8fa38cf1bb"`);
        await queryRunner.query(`DROP TABLE "broadcast"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`broadcast\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`title\` varchar(255) NOT NULL, \`content\` json NOT NULL, \`category\` varchar(255) NOT NULL, \`visibilityMode\` varchar(255) NOT NULL, \`audienceRules\` json NULL, \`publishedAt\` datetime NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_6e01fb5c3ce6fbfe8fa38cf1bb\` (\`createdByUserId\`), INDEX \`IDX_47bc59cf349434e04e9448f3ef\` (\`updatedByUserId\`), INDEX \`IDX_b511fa9568f1acacae0241f9e6\` (\`deletedByUserId\`), INDEX \`IDX_6198c2b3cf1f868ae9f69b202e\` (\`isActive\`), INDEX \`IDX_b5b3d80e1005ca9d82ab577338\` (\`isArchived\`), INDEX \`IDX_9c996b4cdf8236910fd9e18005\` (\`tenantId\`), INDEX \`IDX_ed8c836fac026bf6f1431246de\` (\`organizationId\`), INDEX \`IDX_b930d7578dd832187c44c24bd6\` (\`entity\`), INDEX \`IDX_354c4da2b48a36b06f65651a5e\` (\`entityId\`), INDEX \`IDX_5db346677d4d8f6e7b27bf475e\` (\`category\`), INDEX \`IDX_1cd9bdb332d577cfc8bb9a91b3\` (\`visibilityMode\`), INDEX \`IDX_65274ebe8c704c12ae9c7a4dab\` (\`publishedAt\`), INDEX \`IDX_a1587283393ae3e01f547fe7dc\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_6e01fb5c3ce6fbfe8fa38cf1bbd\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_47bc59cf349434e04e9448f3ef2\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_b511fa9568f1acacae0241f9e6a\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_9c996b4cdf8236910fd9e180054\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_ed8c836fac026bf6f1431246de5\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`broadcast\` ADD CONSTRAINT \`FK_a1587283393ae3e01f547fe7dca\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_a1587283393ae3e01f547fe7dca\``);
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_ed8c836fac026bf6f1431246de5\``);
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_9c996b4cdf8236910fd9e180054\``);
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_b511fa9568f1acacae0241f9e6a\``);
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_47bc59cf349434e04e9448f3ef2\``);
        await queryRunner.query(`ALTER TABLE \`broadcast\` DROP FOREIGN KEY \`FK_6e01fb5c3ce6fbfe8fa38cf1bbd\``);
        await queryRunner.query(`DROP INDEX \`IDX_a1587283393ae3e01f547fe7dc\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_65274ebe8c704c12ae9c7a4dab\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_1cd9bdb332d577cfc8bb9a91b3\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_5db346677d4d8f6e7b27bf475e\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_354c4da2b48a36b06f65651a5e\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_b930d7578dd832187c44c24bd6\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_ed8c836fac026bf6f1431246de\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_9c996b4cdf8236910fd9e18005\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_b5b3d80e1005ca9d82ab577338\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_6198c2b3cf1f868ae9f69b202e\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_b511fa9568f1acacae0241f9e6\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_47bc59cf349434e04e9448f3ef\` ON \`broadcast\``);
        await queryRunner.query(`DROP INDEX \`IDX_6e01fb5c3ce6fbfe8fa38cf1bb\` ON \`broadcast\``);
        await queryRunner.query(`DROP TABLE \`broadcast\``);
    }
}
