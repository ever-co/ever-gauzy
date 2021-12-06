import { Connection, ConnectionOptions, createConnection, getConnection } from 'typeorm';
import * as chalk from 'chalk';
import { DEFAULT_DB_CONNECTION, IPluginConfig } from "@gauzy/common";
import { registerPluginConfig } from './../bootstrap';

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
        for (const migration of migrations) {
            console.log(chalk.green(`Migration ${migration.name} has been run successfully!`));
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
async function  closeConnection(connection: Connection) {
    try {
        if (connection && connection.isConnected) {
            await connection.close();
            console.log(chalk.green(`✅ DISCONNECTED TO DATABASE!`));
        }
    } catch (error) {
        console.log('Error while disconnecting to the database', error);
    }
}