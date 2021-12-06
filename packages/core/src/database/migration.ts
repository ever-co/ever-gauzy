import * as chalk from 'chalk';
import { DEFAULT_DB_CONNECTION, IPluginConfig } from "@gauzy/common";
import { registerPluginConfig } from './../bootstrap';
import { Connection, ConnectionOptions, createConnection, getConnection } from 'typeorm';

/**
 * Run Pending Database Migrations
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
 * Establish Database Connection
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
        console.error(error, 'Unable to connect to database');
    }
    return connection;
}

/**
 * Close Database Connection
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
        console.log('NOTE: DATABASE CONNECTION DOES NOT EXIST YET. CANT CLOSE CONNECTION!');
    }
}