import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { IntegrationTypeEnum } from "@gauzy/contracts";
import { DEFAULT_INTEGRATIONS, PROJECT_MANAGE_DEFAULT_INTEGRATIONS } from "../../integration/default-integration";
import { IntegrationsUtils } from "../../integration/utils";
import { DatabaseTypeEnum } from "@gauzy/config";

export class SeedIntegrationsAndIntegrationTypes1695112275840 implements MigrationInterface {

    name = 'SeedIntegrationsAndIntegrationTypes1695112275840';

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
            case DatabaseTypeEnum.postgres:
                await this.sqlitePostgresUpsert(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlUpsert(queryRunner);
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
    public async down(queryRunner: QueryRunner): Promise<void> { }

    /**
    * Sqlite | better-sqlite3 | Postgres Up Migration
    *
    * @param queryRunner
    */
    public async sqlitePostgresUpsert(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        await IntegrationsUtils.upsertIntegrationTypes(queryRunner, [IntegrationTypeEnum.PROJECT_MANAGEMENT]);
        await IntegrationsUtils.upsertIntegrationsAndIntegrationTypes(queryRunner, PROJECT_MANAGE_DEFAULT_INTEGRATIONS);
        await IntegrationsUtils.upsertIntegrationsAndIntegrationTypes(queryRunner, DEFAULT_INTEGRATIONS);
    }

    /**
    * MySQL Up Migration
    *
    * @param queryRunner
    */
    public async mysqlUpsert(queryRunner: QueryRunner): Promise<any> { }
}
