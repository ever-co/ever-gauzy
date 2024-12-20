import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddOrganizationProjectTeamRelation1692256031607 implements MigrationInterface {

    name = 'AddOrganizationProjectTeamRelation1692256031607';

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
        await queryRunner.query(`CREATE TABLE "organization_project_team" ("organizationProjectId" uuid NOT NULL, "organizationTeamId" uuid NOT NULL, CONSTRAINT "PK_a9a3f212a3e0e2f5e6dba06edd0" PRIMARY KEY ("organizationProjectId", "organizationTeamId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7c31431ff2173c2c939a0aa036" ON "organization_project_team" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_599a5f7f6c190822dcfdbbb6eb" ON "organization_project_team" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "organization_project_team" ADD CONSTRAINT "FK_7c31431ff2173c2c939a0aa036c" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_project_team" ADD CONSTRAINT "FK_599a5f7f6c190822dcfdbbb6eb0" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_project_team" DROP CONSTRAINT "FK_599a5f7f6c190822dcfdbbb6eb0"`);
        await queryRunner.query(`ALTER TABLE "organization_project_team" DROP CONSTRAINT "FK_7c31431ff2173c2c939a0aa036c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_599a5f7f6c190822dcfdbbb6eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c31431ff2173c2c939a0aa036"`);
        await queryRunner.query(`DROP TABLE "organization_project_team"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_project_team" ("organizationProjectId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("organizationProjectId", "organizationTeamId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7c31431ff2173c2c939a0aa036" ON "organization_project_team" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_599a5f7f6c190822dcfdbbb6eb" ON "organization_project_team" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_7c31431ff2173c2c939a0aa036"`);
        await queryRunner.query(`DROP INDEX "IDX_599a5f7f6c190822dcfdbbb6eb"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_project_team" ("organizationProjectId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, CONSTRAINT "FK_7c31431ff2173c2c939a0aa036c" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_599a5f7f6c190822dcfdbbb6eb0" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectId", "organizationTeamId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_project_team"("organizationProjectId", "organizationTeamId") SELECT "organizationProjectId", "organizationTeamId" FROM "organization_project_team"`);
        await queryRunner.query(`DROP TABLE "organization_project_team"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_project_team" RENAME TO "organization_project_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c31431ff2173c2c939a0aa036" ON "organization_project_team" ("organizationProjectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_599a5f7f6c190822dcfdbbb6eb" ON "organization_project_team" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_599a5f7f6c190822dcfdbbb6eb"`);
        await queryRunner.query(`DROP INDEX "IDX_7c31431ff2173c2c939a0aa036"`);
        await queryRunner.query(`ALTER TABLE "organization_project_team" RENAME TO "temporary_organization_project_team"`);
        await queryRunner.query(`CREATE TABLE "organization_project_team" ("organizationProjectId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("organizationProjectId", "organizationTeamId"))`);
        await queryRunner.query(`INSERT INTO "organization_project_team"("organizationProjectId", "organizationTeamId") SELECT "organizationProjectId", "organizationTeamId" FROM "temporary_organization_project_team"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_project_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_599a5f7f6c190822dcfdbbb6eb" ON "organization_project_team" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c31431ff2173c2c939a0aa036" ON "organization_project_team" ("organizationProjectId") `);
        await queryRunner.query(`DROP INDEX "IDX_599a5f7f6c190822dcfdbbb6eb"`);
        await queryRunner.query(`DROP INDEX "IDX_7c31431ff2173c2c939a0aa036"`);
        await queryRunner.query(`DROP TABLE "organization_project_team"`);
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
