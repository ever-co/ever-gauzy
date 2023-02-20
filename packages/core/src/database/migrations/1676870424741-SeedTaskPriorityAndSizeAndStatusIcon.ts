
import { MigrationInterface, QueryRunner } from "typeorm";
import { getConfig } from "@gauzy/config";
import { copyEverIcons } from "./../../core/seeds/utils";
import { DEFAULT_GLOBAL_PRIORITIES } from "./../../tasks/priorities/default-global-priorities";
import { DEFAULT_GLOBAL_SIZES } from "./../../tasks/sizes/default-global-sizes";
import { DEFAULT_GLOBAL_STATUSES } from "./../../tasks/statuses/default-global-statuses";

export class SeedTaskPriorityAndSizeAndStatusIcon1676870424741 implements MigrationInterface {

    config = getConfig();
    name = 'SeedTaskPriorityAndSizeAndStatusIcon1676870424741';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        await this.seedTaskStatusIcon(queryRunner);
        await this.seedTaskPriorityIcon(queryRunner);
        await this.seedTaskSizeIcon(queryRunner);
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> { }

    /**
     *
     * @param queryRunner
     */
    async seedTaskStatusIcon(queryRunner: QueryRunner) {
        try {
            console.log(this.config);
            for await (const status of DEFAULT_GLOBAL_STATUSES) {
                const { name, value, icon, color } = status;

                const query = `UPDATE "task_status" SET "icon" = '${icon}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                copyEverIcons(status.icon, this.config);
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
    async seedTaskPriorityIcon(queryRunner: QueryRunner) {
        try {
            console.log(this.config);
            for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
                const { name, value, icon, color } = priority;

                const query = `UPDATE "task_priority" SET "icon" = '${icon}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                copyEverIcons(priority.icon, this.config);
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
    async seedTaskSizeIcon(queryRunner: QueryRunner) {
        try {
            for await (const size of DEFAULT_GLOBAL_SIZES) {
                const { name, value, icon, color } = size;

                const query = `UPDATE "task_size" SET "icon" = '${icon}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
                await queryRunner.connection.manager.query(query, [name, value]);
                copyEverIcons(size.icon, this.config);
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while updating task sizes icon & color in production server', error);
        }
    }
}
