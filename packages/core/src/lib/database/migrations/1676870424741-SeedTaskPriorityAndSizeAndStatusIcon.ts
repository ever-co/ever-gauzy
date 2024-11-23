import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { getConfig } from "@gauzy/config";
import { copyAssets } from "../../core/seeds/utils";
import { DEFAULT_GLOBAL_PRIORITIES } from "../../tasks/priorities/default-global-priorities";
import { DEFAULT_GLOBAL_SIZES } from "../../tasks/sizes/default-global-sizes";
import { DEFAULT_GLOBAL_STATUSES } from "../../tasks/statuses/default-global-statuses";
import { DatabaseTypeEnum } from "@gauzy/config";

export class SeedTaskPriorityAndSizeAndStatusIcon1676870424741 implements MigrationInterface {

    config = getConfig();
    name = 'SeedTaskPriorityAndSizeAndStatusIcon1676870424741';

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
                await this.sqliteSeedTaskPriorityIcon(queryRunner);
                await this.sqliteSeedTaskSizeIcon(queryRunner);
                await this.sqliteSeedTaskStatusIcon(queryRunner);
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresSeedTaskPriorityIcon(queryRunner);
                await this.postgresSeedTaskSizeIcon(queryRunner);
                await this.postgresSeedTaskStatusIcon(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlSeedTaskPriorityIcon(queryRunner);
                await this.mysqlSeedTaskSizeIcon(queryRunner);
                await this.mysqlSeedTaskStatusIcon(queryRunner);
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
     *
     * @param queryRunner
     */
    async sqliteSeedTaskStatusIcon(queryRunner: QueryRunner) {
        try {
            for await (const status of DEFAULT_GLOBAL_STATUSES) {
                const { name, value, icon, color } = status;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_status" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = ? AND "value" = ?) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                await copyAssets(status.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task statuses icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async sqliteSeedTaskPriorityIcon(queryRunner: QueryRunner) {
        try {
            for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
                const { name, value, icon, color } = priority;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_priority" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = ? AND "value" = ?) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                await copyAssets(priority.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task priorities icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async sqliteSeedTaskSizeIcon(queryRunner: QueryRunner) {
        try {
            for await (const size of DEFAULT_GLOBAL_SIZES) {
                const { name, value, icon, color } = size;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_size" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = ? AND "value" = ?) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                await copyAssets(size.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task sizes icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async postgresSeedTaskStatusIcon(queryRunner: QueryRunner) {
        try {
            for await (const status of DEFAULT_GLOBAL_STATUSES) {
                const { name, value, icon, color } = status;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_status" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                await copyAssets(status.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task statuses icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async postgresSeedTaskPriorityIcon(queryRunner: QueryRunner) {
        try {
            for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
                const { name, value, icon, color } = priority;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_priority" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                await copyAssets(priority.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task priorities icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async postgresSeedTaskSizeIcon(queryRunner: QueryRunner) {
        try {
            for await (const size of DEFAULT_GLOBAL_SIZES) {
                const { name, value, icon, color } = size;
                const filepath = `ever-icons/${icon}`;
                const query = `UPDATE "task_size" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
				await copyAssets(size.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task sizes icon & color in production server', error);
        }
    }

    /**
     *
     * @param queryRunner
     */
    async mysqlSeedTaskStatusIcon(queryRunner: QueryRunner) { }

    /**
     *
     * @param queryRunner
     */
    async mysqlSeedTaskPriorityIcon(queryRunner: QueryRunner) { }

    /**
     *
     * @param queryRunner
     */
    async mysqlSeedTaskSizeIcon(queryRunner: QueryRunner) { }
}
