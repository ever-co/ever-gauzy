import { DataSource, DataSourceOptions } from 'typeorm';
import { camelCase } from 'typeorm/util/StringUtils';
import * as chalk from 'chalk';
import * as path from 'path';
import { ApplicationPluginConfig, isNotEmpty } from '@gauzy/common';
import { DatabaseTypeEnum } from '@gauzy/config';
import { registerPluginConfig } from '../bootstrap';
import { IMigrationOptions } from './migration-interface';
import { MigrationUtils } from './migration-utils';
import { isDatabaseType, isSqliteDB } from './../core/utils';

/**
 * @description
 * Run pending database migrations. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 *
 * @param pluginConfig
 */
export async function runDatabaseMigrations(pluginConfig: Partial<ApplicationPluginConfig>) {
    const config = await registerPluginConfig(pluginConfig);
    const dataSource: DataSource = await establishDatabaseConnection(config);

    try {
        const migrations = await dataSource.runMigrations({ transaction: 'each' });
        if (isNotEmpty(migrations)) {
            for (const migration of migrations) {
                console.log(chalk.green(`Migration ${migration.name} has been run successfully!`));
            }
        } else {
            console.log(chalk.yellow(`There are no pending migrations to run.`));
        }
    } catch (error) {
        if (dataSource) (await closeConnection(dataSource));

        console.log(chalk.black.bgRed("Error during migration run:"));
        console.error(error);
        process.exit(1);
    } finally {
        await closeConnection(dataSource);
    }
}

/**
 * @description
 * Reverts last applied database migration. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 *
 * @param pluginConfig
 */
export async function revertLastDatabaseMigration(pluginConfig: Partial<ApplicationPluginConfig>) {
    const config = await registerPluginConfig(pluginConfig);
    const connection = await establishDatabaseConnection(config);

    try {
        await connection.undoLastMigration({ transaction: 'each' });
        console.log(chalk.green(`Migration has been reverted successfully!`));
    } catch (error) {
        if (connection) (await closeConnection(connection));

        console.log(chalk.black.bgRed("Error during migration revert:"));
        console.error(error);
        process.exit(1);
    } finally {
        await closeConnection(connection);
    }
}

/**
 * @description
 * Generates a new migration file with sql needs to be executed to update schema.
 *
 * @param pluginConfig
 */
export async function generateMigration(pluginConfig: Partial<ApplicationPluginConfig>, options: IMigrationOptions) {
    if (!options.name) {
        console.log(chalk.yellow("Migration name must be required.Please specify migration name!"));
        return;
    }
    const config = await registerPluginConfig(pluginConfig);

    let directory = options.dir;
    // if directory is not set then try to open plugin config and find default path there
    if (!directory) {
        try {
            directory = config.dbConnectionOptions['cli'] ? config.dbConnectionOptions['cli']['migrationsDir'] : undefined;
        } catch (err) {
            console.log('Error while finding migration directory', err);
        }
    }

    const connection = await establishDatabaseConnection(config);
    try {
        const sqlInMemory = await connection.driver.createSchemaBuilder().log();
        const upSqls: string[] = [];
        const downSqls: string[] = [];

        sqlInMemory.upQueries.forEach(upQuery => {
            upSqls.push("await queryRunner.query(`" + upQuery.query.replace(new RegExp("`", "g"), "\\`") + "`" + queryParams(upQuery.parameters) + ");");
        });
        sqlInMemory.downQueries.forEach(downQuery => {
            downSqls.push("await queryRunner.query(`" + downQuery.query.replace(new RegExp("`", "g"), "\\`") + "`" + queryParams(downQuery.parameters) + ");");
        });

        if (upSqls.length) {
            const timestamp = new Date().getTime();
            /**
             *  Gets contents of the migration file.
             */
            const fileContent = getTemplate(
                connection,
                options.name as any,
                timestamp,
                upSqls,
                downSqls.reverse()
            );

            const filename = timestamp + "-" + options.name + ".ts";
            const outputPath = directory ? path.join(directory, filename) : path.join(process.cwd(), filename);

            try {
                await MigrationUtils.createFile(outputPath, fileContent);
                console.log(chalk.green(`Migration ${chalk.blue(outputPath)} has been generated successfully.`));
            } catch (error) {
                console.log(chalk.black.bgRed("Error during migration generating files:"));
                console.error(error);
            }
        } else {
            console.log(chalk.yellow(`No changes in database schema were found - cannot generate a migration. To create a new empty migration use "yarn run migration:create" command`));
        }
    } catch (error) {
        if (connection) (await closeConnection(connection));

        console.log(chalk.black.bgRed("Error during migration generation:"));
        console.error(error);
        process.exit(1);
    } finally {
        await closeConnection(connection);
    }
}

/**
 * @description
 * Create a new blank migration file to be executed to create/update schema.
 *
 * @param pluginConfig
 */
export async function createMigration(pluginConfig: Partial<ApplicationPluginConfig>, options: IMigrationOptions) {
    if (!options.name) {
        console.log(chalk.yellow("Migration name must be required.Please specify migration name!"));
        return;
    }
    const config = await registerPluginConfig(pluginConfig);

    let directory = options.dir;
    // if directory is not set then try to open plugin config and find default path there
    if (!directory) {
        try {
            directory = config.dbConnectionOptions['cli'] ? config.dbConnectionOptions['cli']['migrationsDir'] : undefined;
        } catch (err) {
            console.log('Error while finding migration directory', err);
        }
    }

    const connection = await establishDatabaseConnection(config);
    try {
        const timestamp = new Date().getTime();
        /**
         *  Gets contents of the migration file.
         */
        const fileContent = getTemplate(
            connection,
            options.name as any,
            timestamp,
            [],
            []
        );

        const filename = timestamp + "-" + options.name + ".ts";
        const outputPath = directory ? path.join(directory, filename) : path.join(process.cwd(), filename);

        try {
            await MigrationUtils.createFile(outputPath, fileContent);
            console.log(chalk.green(`Migration ${chalk.blue(outputPath)} has been created successfully.`));
        } catch (error) {
            console.log(chalk.black.bgRed("Error during migration creating files:"));
            console.error(error);
        }
    } catch (error) {
        if (connection) (await closeConnection(connection));

        console.log(chalk.black.bgRed("Error during migration create:"));
        console.error(error);
        process.exit(1);
    } finally {
        await closeConnection(connection);
    }
}

/**
 * @description
 * Establish new database connection, if not found any connection. See [TypeORM migration docs](https://typeorm.io/#/connection)
 *
 * @param config
 */
export async function establishDatabaseConnection(config: Partial<ApplicationPluginConfig>): Promise<DataSource> {
    const { dbConnectionOptions } = config;
    const overrideDbConfig = {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: ['all']
    };

    let dataSource: DataSource;
    try {
        console.log(chalk.yellow('NOTE: DATABASE CONNECTION DOES NOT EXIST YET. NEW ONE WILL BE CREATED!'));
        try {
            console.log(chalk.green(`CONNECTING TO DATABASE...`));
            dataSource = new DataSource({
                ...dbConnectionOptions,
                ...overrideDbConfig
            } as DataSourceOptions);
            if (!dataSource.isInitialized) {
                await dataSource.initialize();
                console.log(chalk.green(`✅ CONNECTED TO DATABASE!`));
            }
        } catch (error) {
            console.log('Unable to connect to database', error);
        }
    } catch (error) {
        console.log('Error while connecting to the database', error);
    }
    return dataSource;
}

/**
 * @description
 * Close database connection, after complete or failed process
 *
 * @param connection
 */
async function closeConnection(dataSource: DataSource) {
    try {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
            console.log(chalk.green(`✅ DISCONNECTED TO DATABASE!`));
        }
    } catch (error) {
        console.log('Error while disconnecting to the database', error);
    }
}

/**
 * Formats query parameters for migration queries if parameters actually exist
 */
function queryParams(parameters: any[] | undefined): string {
    if (!parameters || !parameters.length) {
        return "";
    }

    return `, ${JSON.stringify(parameters)}`;
}

/**
 * Gets contents of the migration file.
 */
function getTemplate(connection: DataSource, name: string, timestamp: number, upSqls: string[], downSqls: string[]): string {
    return `
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class ${camelCase(name, true)}${timestamp} implements MigrationInterface {

    name = '${camelCase(name, true)}${timestamp}';

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
                throw Error(\`Unsupported database: \${queryRunner.connection.options.type}\`);
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
                throw Error(\`Unsupported database: \${queryRunner.connection.options.type}\`);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.postgres], connection.options) ? upSqls.join(`
        `) : [].join(`
        `)}
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.postgres], connection.options) ? downSqls.join(`
        `) : [].join(`
        `)}
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${(isSqliteDB(connection.options)) ? upSqls.join(`
        `) : [].join(`
        `)}
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${(isSqliteDB(connection.options)) ? downSqls.join(`
        `) : [].join(`
        `)}
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.mysql], connection.options) ?
            upSqls.join(``) :
            [].join(``)
        }
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.mysql], connection.options) ?
            downSqls.join(``) :
            [].join(``)
        }
    }
}
`;
}
