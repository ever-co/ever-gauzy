import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum, getConfig } from "@gauzy/config";
import { copyAssets } from "../../core/seeds/utils";
import { DEFAULT_GLOBAL_PRIORITIES } from "../../tasks/priorities/default-global-priorities";
import { DEFAULT_GLOBAL_SIZES } from "../../tasks/sizes/default-global-sizes";
import { DEFAULT_GLOBAL_STATUSES } from "../../tasks/statuses/default-global-statuses";

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
	 * Seeds task status icons and colors in an SQLite database.
	 *
	 * This function updates the `task_status` table with predefined global statuses (`DEFAULT_GLOBAL_STATUSES`),
	 * setting `icon` and `color` fields where the `name` and `value` match, and both `tenantId` and `organizationId` are `NULL`.
	 * It also copies the respective icon files to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance for executing database queries.
	 * @returns {Promise<void>} - Resolves when the seeding operation is complete.
	 */
	async sqliteSeedTaskStatusIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate over each predefined global status
			for (const status of DEFAULT_GLOBAL_STATUSES) {
				const { name, value, icon, color } = status;

				// Build the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// SQLite query to update task status
				const query = `
					UPDATE "task_status"
					SET "icon" = ?, "color" = ?
					WHERE "name" = ? AND "value" = ?
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the SQL update query
					await queryRunner.connection.manager.query(query, [filepath, color, name, value]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					console.error(`Error updating status "${name}" in SQLite:`, queryError);
				}
			}
		} catch (error) {
			// Log the overall error if something fails in the seeding process
			console.error('Error while seeding task statuses icon & color in SQLite database:', error);
		}
	}

	/**
	 * Seeds task priority icons and colors in an SQLite database.
	 *
	 * This function updates the `task_priority` table with predefined global priorities (`DEFAULT_GLOBAL_PRIORITIES`),
	 * setting `icon` and `color` fields where the `name` and `value` match, and both `tenantId` and `organizationId` are `NULL`.
	 * It also copies the respective icon files to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance for executing database queries.
	 * @returns {Promise<void>} - Resolves when the seeding operation is complete.
	 */
	async sqliteSeedTaskPriorityIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate through each predefined global priority
			for (const priority of DEFAULT_GLOBAL_PRIORITIES) {
				const { name, value, icon, color } = priority;

				// Build the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// SQLite query to update task priority
				const query = `
					UPDATE "task_priority"
					SET "icon" = ?, "color" = ?
					WHERE "name" = ? AND "value" = ?
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the SQL update query
					await queryRunner.connection.manager.query(query, [filepath, color, name, value]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					console.error(`Error updating priority "${name}" in SQLite:`, queryError);
				}
			}
		} catch (error) {
			// Log the overall error if something fails in the seeding process
			console.error('Error while seeding task priorities icon & color in SQLite database:', error);
		}
	}

    /**
	 * Seeds task size icons and colors in an SQLite database.
	 *
	 * This function updates the `task_size` table with predefined global sizes (`DEFAULT_GLOBAL_SIZES`),
	 * setting the `icon` and `color` fields for records where the `name` and `value` match and
	 * both `tenantId` and `organizationId` are `NULL`. It also copies the respective icon files
	 * to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance for executing database queries.
	 * @returns {Promise<void>} - Resolves when the seeding operation is complete.
	 */
	async sqliteSeedTaskSizeIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate through each predefined global size
			for (const size of DEFAULT_GLOBAL_SIZES) {
				const { name, value, icon, color } = size;

				// Construct the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// SQLite query to update the task size table
				const query = `
					UPDATE "task_size"
					SET "icon" = ?, "color" = ?
					WHERE "name" = ? AND "value" = ?
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the query with parameters
					await queryRunner.connection.manager.query(query, [filepath, color, name, value]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					// Handle errors for specific sizes
					console.error(`Error updating size "${name}" with icon "${icon}":`, queryError);
				}
			}
		} catch (error) {
			// Handle overall errors in the seeding process
			console.error('Error while seeding task sizes icons and colors in SQLite database:', error);
		}
	}

    /**
	 * Seeds task status icons and colors in a PostgreSQL database.
	 *
	 * This function updates the `task_status` table with predefined global statuses (`DEFAULT_GLOBAL_STATUSES`),
	 * setting `icon` and `color` fields for records where the `name` and `value` match, and both `tenantId`
	 * and `organizationId` are `NULL`. It also copies the respective icon files to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance for executing database queries.
	 * @returns {Promise<void>} - Resolves when the seeding operation is complete.
	 */
	async postgresSeedTaskStatusIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate through each predefined global status
			for (const status of DEFAULT_GLOBAL_STATUSES) {
				const { name, value, icon, color } = status;

				// Construct the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// PostgreSQL query to update the task status table
				const query = `
					UPDATE "task_status"
					SET "icon" = $3, "color" = $4
					WHERE "name" = $1 AND "value" = $2
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the query with parameters
					await queryRunner.connection.manager.query(query, [name, value, filepath, color]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					// Log specific errors for individual status updates
					console.error(`Error updating status "${name}" with icon "${icon}":`, queryError);
				}
			}
		} catch (error) {
			// Handle overall errors in the seeding process
			console.error('Error while seeding task statuses icons and colors in PostgreSQL database:', error);
		}
	}

	/**
	 * Seeds task priority icons and colors in a PostgreSQL database.
	 *
	 * This function updates the `task_priority` table with predefined global priorities (`DEFAULT_GLOBAL_PRIORITIES`),
	 * setting `icon` and `color` fields for records where the `name` and `value` match and both `tenantId` and `organizationId` are `NULL`.
	 * Additionally, it copies the corresponding icon files to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance used to execute queries within a transaction.
	 * @returns {Promise<void>} - Resolves when the seeding operation is complete.
	 */
	async postgresSeedTaskPriorityIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate over each predefined global priority
			for (const priority of DEFAULT_GLOBAL_PRIORITIES) {
				const { name, value, icon, color } = priority;

				// Construct the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// PostgreSQL query to update task priority
				const query = `
					UPDATE "task_priority"
					SET "icon" = $3, "color" = $4
					WHERE "name" = $1 AND "value" = $2
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the query with parameters
					await queryRunner.connection.manager.query(query, [name, value, filepath, color]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					// Log specific errors for individual priorities
					console.error(`Error updating priority "${name}" with icon "${icon}":`, queryError);
				}
			}
		} catch (error) {
			// Handle overall errors in the seeding process
			console.error('Error while seeding task priorities icons and colors in PostgreSQL database:', error);
		}
	}

	/**
	 * Seeds task size icons and colors in a PostgreSQL database.
	 *
	 * This function updates the `task_size` table with predefined global sizes (`DEFAULT_GLOBAL_SIZES`),
	 * setting the `icon` and `color` fields for records where the `name` and `value` match,
	 * and both `tenantId` and `organizationId` are `NULL`. Additionally, it copies the respective
	 * icon files to the specified public directory.
	 *
	 * @param {QueryRunner} queryRunner - The QueryRunner instance used to execute queries within a transaction.
	 * @returns {Promise<void>} - Resolves when the seeding process is complete.
	 */
	async postgresSeedTaskSizeIcon(queryRunner: QueryRunner): Promise<void> {
		try {
			// Iterate through each predefined global size
			for (const size of DEFAULT_GLOBAL_SIZES) {
				const { name, value, icon, color } = size;

				// Construct the file path for the icon
				const filepath = `ever-icons/${icon}`;

				// PostgreSQL query to update task size
				const query = `
					UPDATE "task_size"
					SET "icon" = $3, "color" = $4
					WHERE "name" = $1 AND "value" = $2
					AND "tenantId" IS NULL AND "organizationId" IS NULL
				`;

				try {
					// Execute the query with parameters
					await queryRunner.connection.manager.query(query, [name, value, filepath, color]);

					// Copy the icon asset to the destination directory
					copyAssets(icon, this.config, 'ever-icons');
				} catch (queryError) {
					// Log specific errors for individual sizes
					console.error(`Error updating size "${name}" with icon "${icon}":`, queryError);
				}
			}
		} catch (error) {
			// Handle overall errors in the seeding process
			console.error('Error while seeding task sizes icons and colors in PostgreSQL database:', error);
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
