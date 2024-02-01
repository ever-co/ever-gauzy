import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from "chalk";
import { RolePermissionUtils } from '../../role-permission/utils';
import { DatabaseTypeEnum } from "@gauzy/config";

export class RolePermissionsReload1644312012849 implements MigrationInterface {
    name = 'RolePermissionsReload1644312012849';

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

    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        try {
            await RolePermissionUtils.migrateRolePermissions(queryRunner);
        } catch (error) {
            console.log(`Error while migrating missing role permisions`, error);
        }
    }

    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        try {
            await RolePermissionUtils.migrateRolePermissions(queryRunner);
        } catch (error) {
            console.log(`Error while migrating missing role permisions`, error);
        }
    }

    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

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
