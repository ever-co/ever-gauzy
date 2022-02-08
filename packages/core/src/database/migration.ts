import { Connection, ConnectionOptions, createConnection, getConnection } from 'typeorm';
import * as chalk from 'chalk';
import * as path from 'path';
import { DEFAULT_DB_CONNECTION, IPluginConfig, isNotEmpty } from "@gauzy/common";
import { camelCase } from 'typeorm/util/StringUtils';
import { registerPluginConfig } from './../bootstrap';
import { MigrationUtils } from './utils';

/**
 * @description
 * Configuration migration options for generating a new migration
 *
 */
 export interface IMigrationOptions {
    /**
     * @description
     * Name of the migration class.
     * `{TIMESTAMP}-{name}.ts`.
     */
    name: string;

    /**
     * @description
     * Directory where migration should be created.
     */
    dir?: string;

    /**
     * @description
     * Name of the file with connection configuration..
     */
    config?: string;
}

/**
 * @description
 * Run pending database migrations. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 * 
 * @param pluginConfig 
 */
export async function runDatabaseMigrations(pluginConfig: Partial<IPluginConfig>) {
    const config = await registerPluginConfig(pluginConfig);
    const connection = await establishDatabaseConnection(config);
    
    try {
        const migrations = await connection.runMigrations({ transaction: 'each' });
        if (isNotEmpty(migrations)) {
            for (const migration of migrations) {
                console.log(chalk.green(`Migration ${migration.name} has been run successfully!`));
            }
        } else {
            console.log(chalk.yellow(`There are no pending migrations to run.`));
        }
    } catch (error) {
        if (connection) (await closeConnection(connection));

        console.log(chalk.black.bgRed("Error during migration run:"));
        console.error(error);
        process.exit(1);
    } finally {
        await closeConnection(connection);
    }
}

/**
 * @description
 * Reverts last applied database migration. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 * 
 * @param pluginConfig 
 */
 export async function revertLastDatabaseMigration(pluginConfig: Partial<IPluginConfig>) {
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
export async function generateMigration(pluginConfig: Partial<IPluginConfig>, options: IMigrationOptions) {
    if (!options.name) {
        console.log(chalk.yellow("Migration name must be requried.Please specify migration name!"));
        return;
    }
    const config = await registerPluginConfig(pluginConfig);

    let directory = options.dir;
    // if directory is not set then try to open plugin config and find default path there
    if (!directory) {
        try {
            directory = config.dbConnectionOptions.cli ? config.dbConnectionOptions.cli.migrationsDir : undefined;
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
 export async function createMigration(pluginConfig: Partial<IPluginConfig>, options: IMigrationOptions) {
    if (!options.name) {
        console.log(chalk.yellow("Migration name must be requried.Please specify migration name!"));
        return;
    }
    const config = await registerPluginConfig(pluginConfig);

    let directory = options.dir;
    // if directory is not set then try to open plugin config and find default path there
    if (!directory) {
        try {
            directory = config.dbConnectionOptions.cli ? config.dbConnectionOptions.cli.migrationsDir : undefined;
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
export async function establishDatabaseConnection(config: Partial<IPluginConfig>): Promise<Connection> {
    const { dbConnectionOptions } = config;
    const overrideDbConfig = {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: ["query", "error", "schema"]
    };

    let connection: Connection|undefined = undefined;
    try {
        connection = getConnection(DEFAULT_DB_CONNECTION);
    } catch (error) {
        console.log(chalk.yellow('NOTE: DATABASE CONNECTION DOES NOT EXIST YET. NEW ONE WILL BE CREATED!'));
    }
    try {
        if (!connection || !connection.isConnected) {
            connection = await createConnection({
                name: DEFAULT_DB_CONNECTION,
                ...dbConnectionOptions,
                ...overrideDbConfig
            } as ConnectionOptions);
            console.log(chalk.green(`✅ CONNECTED TO DATABASE!`));
        }
    } catch (error) {
        console.log('Error while connecting to the database', error);
    }
    return connection;
}

/**
 * @description
 * Close database connection, after complete or failed process
 * 
 * @param connection 
 */
async function closeConnection(connection: Connection) {
    try {
        if (connection && connection.isConnected) {
            await connection.close();
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
function getTemplate(name: string, timestamp: number, upSqls: string[], downSqls: string[]): string {
    return `import { MigrationInterface, QueryRunner } from "typeorm";
    
    export class ${camelCase(name, true)}${timestamp} implements MigrationInterface {

        name = '${camelCase(name, true)}${timestamp}';
        
        public async up(queryRunner: QueryRunner): Promise<any> {
            ${upSqls.join(`
            `)}
        }
        
        public async down(queryRunner: QueryRunner): Promise<any> {
            ${downSqls.join(`
            `)}
        }
    }`;
}