import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AltereInviteTable1665767813286 implements MigrationInterface {

    name = 'AltereInviteTable1665767813286';

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
        await queryRunner.query(`CREATE TABLE "invite_organization_team" ("inviteId" uuid NOT NULL, "organizationTeamId" uuid NOT NULL, CONSTRAINT "PK_727215f4830d4268283cb17d874" PRIMARY KEY ("inviteId", "organizationTeamId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_104140c94e838a058a34b30a09" ON "invite_organization_team" ("inviteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1132ec0c3618e53fc8cf7ed669" ON "invite_organization_team" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "invite_organization_team" ADD CONSTRAINT "FK_104140c94e838a058a34b30a09c" FOREIGN KEY ("inviteId") REFERENCES "invite"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "invite_organization_team" ADD CONSTRAINT "FK_1132ec0c3618e53fc8cf7ed6694" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invite_organization_team" DROP CONSTRAINT "FK_1132ec0c3618e53fc8cf7ed6694"`);
        await queryRunner.query(`ALTER TABLE "invite_organization_team" DROP CONSTRAINT "FK_104140c94e838a058a34b30a09c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1132ec0c3618e53fc8cf7ed669"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_104140c94e838a058a34b30a09"`);
        await queryRunner.query(`DROP TABLE "invite_organization_team"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "invite_organization_team" ("inviteId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("inviteId", "organizationTeamId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_104140c94e838a058a34b30a09" ON "invite_organization_team" ("inviteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1132ec0c3618e53fc8cf7ed669" ON "invite_organization_team" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_104140c94e838a058a34b30a09"`);
        await queryRunner.query(`DROP INDEX "IDX_1132ec0c3618e53fc8cf7ed669"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite_organization_team" ("inviteId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, CONSTRAINT "FK_104140c94e838a058a34b30a09c" FOREIGN KEY ("inviteId") REFERENCES "invite" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1132ec0c3618e53fc8cf7ed6694" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("inviteId", "organizationTeamId"))`);
        await queryRunner.query(`INSERT INTO "temporary_invite_organization_team"("inviteId", "organizationTeamId") SELECT "inviteId", "organizationTeamId" FROM "invite_organization_team"`);
        await queryRunner.query(`DROP TABLE "invite_organization_team"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite_organization_team" RENAME TO "invite_organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_104140c94e838a058a34b30a09" ON "invite_organization_team" ("inviteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1132ec0c3618e53fc8cf7ed669" ON "invite_organization_team" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_1132ec0c3618e53fc8cf7ed669"`);
        await queryRunner.query(`DROP INDEX "IDX_104140c94e838a058a34b30a09"`);
        await queryRunner.query(`ALTER TABLE "invite_organization_team" RENAME TO "temporary_invite_organization_team"`);
        await queryRunner.query(`CREATE TABLE "invite_organization_team" ("inviteId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("inviteId", "organizationTeamId"))`);
        await queryRunner.query(`INSERT INTO "invite_organization_team"("inviteId", "organizationTeamId") SELECT "inviteId", "organizationTeamId" FROM "temporary_invite_organization_team"`);
        await queryRunner.query(`DROP TABLE "temporary_invite_organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_1132ec0c3618e53fc8cf7ed669" ON "invite_organization_team" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_104140c94e838a058a34b30a09" ON "invite_organization_team" ("inviteId") `);
        await queryRunner.query(`DROP INDEX "IDX_1132ec0c3618e53fc8cf7ed669"`);
        await queryRunner.query(`DROP INDEX "IDX_104140c94e838a058a34b30a09"`);
        await queryRunner.query(`DROP TABLE "invite_organization_team"`);
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
