
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateUserNotificationTable1738217979804 implements MigrationInterface {

    name = 'CreateUserNotificationTable1738217979804';

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
        await queryRunner.query(`CREATE TABLE "user_notification" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "title" character varying NOT NULL, "message" character varying NOT NULL, "type" integer, "isRead" boolean NOT NULL DEFAULT false, "readedAt" TIMESTAMP, "sentById" uuid, "receiverId" uuid, CONSTRAINT "PK_8840aac86dec5f669c541ce67d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6c5f59af45edf24ebe1fb9290a" ON "user_notification" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1162ba6e6e4a847017c1edc88b" ON "user_notification" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b218dc20d7822e0e4d85d81a2" ON "user_notification" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_758686e0a822303c4791999a77" ON "user_notification" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6af19d4e214ca45b5fb57d7fc2" ON "user_notification" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6de2f2e523b7428765d9fabbe" ON "user_notification" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc3e6d279904252599ae41f5bf" ON "user_notification" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d1dae7d71c5eb56d06edf10f" ON "user_notification" ("sentById") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff2d84b36dcf89af3e9b13f643" ON "user_notification" ("receiverId") `);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_6b218dc20d7822e0e4d85d81a2a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_758686e0a822303c4791999a778" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_08d1dae7d71c5eb56d06edf10f0" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_ff2d84b36dcf89af3e9b13f643f" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_ff2d84b36dcf89af3e9b13f643f"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_08d1dae7d71c5eb56d06edf10f0"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_758686e0a822303c4791999a778"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_6b218dc20d7822e0e4d85d81a2a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff2d84b36dcf89af3e9b13f643"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08d1dae7d71c5eb56d06edf10f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc3e6d279904252599ae41f5bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6de2f2e523b7428765d9fabbe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6af19d4e214ca45b5fb57d7fc2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_758686e0a822303c4791999a77"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b218dc20d7822e0e4d85d81a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1162ba6e6e4a847017c1edc88b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6c5f59af45edf24ebe1fb9290a"`);
        await queryRunner.query(`DROP TABLE "user_notification"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "user_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "message" varchar NOT NULL, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readedAt" datetime, "sentById" varchar, "receiverId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_6c5f59af45edf24ebe1fb9290a" ON "user_notification" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1162ba6e6e4a847017c1edc88b" ON "user_notification" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b218dc20d7822e0e4d85d81a2" ON "user_notification" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_758686e0a822303c4791999a77" ON "user_notification" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6af19d4e214ca45b5fb57d7fc2" ON "user_notification" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6de2f2e523b7428765d9fabbe" ON "user_notification" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc3e6d279904252599ae41f5bf" ON "user_notification" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d1dae7d71c5eb56d06edf10f" ON "user_notification" ("sentById") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff2d84b36dcf89af3e9b13f643" ON "user_notification" ("receiverId") `);
        await queryRunner.query(`DROP INDEX "IDX_6c5f59af45edf24ebe1fb9290a"`);
        await queryRunner.query(`DROP INDEX "IDX_1162ba6e6e4a847017c1edc88b"`);
        await queryRunner.query(`DROP INDEX "IDX_6b218dc20d7822e0e4d85d81a2"`);
        await queryRunner.query(`DROP INDEX "IDX_758686e0a822303c4791999a77"`);
        await queryRunner.query(`DROP INDEX "IDX_6af19d4e214ca45b5fb57d7fc2"`);
        await queryRunner.query(`DROP INDEX "IDX_a6de2f2e523b7428765d9fabbe"`);
        await queryRunner.query(`DROP INDEX "IDX_fc3e6d279904252599ae41f5bf"`);
        await queryRunner.query(`DROP INDEX "IDX_08d1dae7d71c5eb56d06edf10f"`);
        await queryRunner.query(`DROP INDEX "IDX_ff2d84b36dcf89af3e9b13f643"`);
        await queryRunner.query(`CREATE TABLE "temporary_user_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "message" varchar NOT NULL, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readedAt" datetime, "sentById" varchar, "receiverId" varchar, CONSTRAINT "FK_6b218dc20d7822e0e4d85d81a2a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_758686e0a822303c4791999a778" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_08d1dae7d71c5eb56d06edf10f0" FOREIGN KEY ("sentById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ff2d84b36dcf89af3e9b13f643f" FOREIGN KEY ("receiverId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readedAt", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readedAt", "sentById", "receiverId" FROM "user_notification"`);
        await queryRunner.query(`DROP TABLE "user_notification"`);
        await queryRunner.query(`ALTER TABLE "temporary_user_notification" RENAME TO "user_notification"`);
        await queryRunner.query(`CREATE INDEX "IDX_6c5f59af45edf24ebe1fb9290a" ON "user_notification" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1162ba6e6e4a847017c1edc88b" ON "user_notification" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b218dc20d7822e0e4d85d81a2" ON "user_notification" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_758686e0a822303c4791999a77" ON "user_notification" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6af19d4e214ca45b5fb57d7fc2" ON "user_notification" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6de2f2e523b7428765d9fabbe" ON "user_notification" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc3e6d279904252599ae41f5bf" ON "user_notification" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d1dae7d71c5eb56d06edf10f" ON "user_notification" ("sentById") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff2d84b36dcf89af3e9b13f643" ON "user_notification" ("receiverId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_ff2d84b36dcf89af3e9b13f643"`);
        await queryRunner.query(`DROP INDEX "IDX_08d1dae7d71c5eb56d06edf10f"`);
        await queryRunner.query(`DROP INDEX "IDX_fc3e6d279904252599ae41f5bf"`);
        await queryRunner.query(`DROP INDEX "IDX_a6de2f2e523b7428765d9fabbe"`);
        await queryRunner.query(`DROP INDEX "IDX_6af19d4e214ca45b5fb57d7fc2"`);
        await queryRunner.query(`DROP INDEX "IDX_758686e0a822303c4791999a77"`);
        await queryRunner.query(`DROP INDEX "IDX_6b218dc20d7822e0e4d85d81a2"`);
        await queryRunner.query(`DROP INDEX "IDX_1162ba6e6e4a847017c1edc88b"`);
        await queryRunner.query(`DROP INDEX "IDX_6c5f59af45edf24ebe1fb9290a"`);
        await queryRunner.query(`ALTER TABLE "user_notification" RENAME TO "temporary_user_notification"`);
        await queryRunner.query(`CREATE TABLE "user_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "message" varchar NOT NULL, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readedAt" datetime, "sentById" varchar, "receiverId" varchar)`);
        await queryRunner.query(`INSERT INTO "user_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readedAt", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readedAt", "sentById", "receiverId" FROM "temporary_user_notification"`);
        await queryRunner.query(`DROP TABLE "temporary_user_notification"`);
        await queryRunner.query(`CREATE INDEX "IDX_ff2d84b36dcf89af3e9b13f643" ON "user_notification" ("receiverId") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d1dae7d71c5eb56d06edf10f" ON "user_notification" ("sentById") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc3e6d279904252599ae41f5bf" ON "user_notification" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6de2f2e523b7428765d9fabbe" ON "user_notification" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6af19d4e214ca45b5fb57d7fc2" ON "user_notification" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_758686e0a822303c4791999a77" ON "user_notification" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b218dc20d7822e0e4d85d81a2" ON "user_notification" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1162ba6e6e4a847017c1edc88b" ON "user_notification" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c5f59af45edf24ebe1fb9290a" ON "user_notification" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_ff2d84b36dcf89af3e9b13f643"`);
        await queryRunner.query(`DROP INDEX "IDX_08d1dae7d71c5eb56d06edf10f"`);
        await queryRunner.query(`DROP INDEX "IDX_fc3e6d279904252599ae41f5bf"`);
        await queryRunner.query(`DROP INDEX "IDX_a6de2f2e523b7428765d9fabbe"`);
        await queryRunner.query(`DROP INDEX "IDX_6af19d4e214ca45b5fb57d7fc2"`);
        await queryRunner.query(`DROP INDEX "IDX_758686e0a822303c4791999a77"`);
        await queryRunner.query(`DROP INDEX "IDX_6b218dc20d7822e0e4d85d81a2"`);
        await queryRunner.query(`DROP INDEX "IDX_1162ba6e6e4a847017c1edc88b"`);
        await queryRunner.query(`DROP INDEX "IDX_6c5f59af45edf24ebe1fb9290a"`);
        await queryRunner.query(`DROP TABLE "user_notification"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`user_notification\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`title\` varchar(255) NOT NULL, \`message\` varchar(255) NOT NULL, \`type\` int NULL, \`isRead\` tinyint NOT NULL DEFAULT 0, \`readedAt\` datetime NULL, \`sentById\` varchar(255) NULL, \`receiverId\` varchar(255) NULL, INDEX \`IDX_6c5f59af45edf24ebe1fb9290a\` (\`isActive\`), INDEX \`IDX_1162ba6e6e4a847017c1edc88b\` (\`isArchived\`), INDEX \`IDX_6b218dc20d7822e0e4d85d81a2\` (\`tenantId\`), INDEX \`IDX_758686e0a822303c4791999a77\` (\`organizationId\`), INDEX \`IDX_6af19d4e214ca45b5fb57d7fc2\` (\`entity\`), INDEX \`IDX_a6de2f2e523b7428765d9fabbe\` (\`entityId\`), INDEX \`IDX_fc3e6d279904252599ae41f5bf\` (\`type\`), INDEX \`IDX_08d1dae7d71c5eb56d06edf10f\` (\`sentById\`), INDEX \`IDX_ff2d84b36dcf89af3e9b13f643\` (\`receiverId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`user_notification\` ADD CONSTRAINT \`FK_6b218dc20d7822e0e4d85d81a2a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_notification\` ADD CONSTRAINT \`FK_758686e0a822303c4791999a778\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user_notification\` ADD CONSTRAINT \`FK_08d1dae7d71c5eb56d06edf10f0\` FOREIGN KEY (\`sentById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_notification\` ADD CONSTRAINT \`FK_ff2d84b36dcf89af3e9b13f643f\` FOREIGN KEY (\`receiverId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`user_notification\` DROP FOREIGN KEY \`FK_ff2d84b36dcf89af3e9b13f643f\``);
        await queryRunner.query(`ALTER TABLE \`user_notification\` DROP FOREIGN KEY \`FK_08d1dae7d71c5eb56d06edf10f0\``);
        await queryRunner.query(`ALTER TABLE \`user_notification\` DROP FOREIGN KEY \`FK_758686e0a822303c4791999a778\``);
        await queryRunner.query(`ALTER TABLE \`user_notification\` DROP FOREIGN KEY \`FK_6b218dc20d7822e0e4d85d81a2a\``);
        await queryRunner.query(`DROP INDEX \`IDX_ff2d84b36dcf89af3e9b13f643\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_08d1dae7d71c5eb56d06edf10f\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_fc3e6d279904252599ae41f5bf\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_a6de2f2e523b7428765d9fabbe\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_6af19d4e214ca45b5fb57d7fc2\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_758686e0a822303c4791999a77\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_6b218dc20d7822e0e4d85d81a2\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_1162ba6e6e4a847017c1edc88b\` ON \`user_notification\``);
        await queryRunner.query(`DROP INDEX \`IDX_6c5f59af45edf24ebe1fb9290a\` ON \`user_notification\``);
        await queryRunner.query(`DROP TABLE \`user_notification\``);
    }
}
