import { DataSource, DataSourceOptions } from 'typeorm';
import { camelCase } from 'typeorm/util/StringUtils';
import * as chalk from 'chalk';
import * as path from 'path';
import { ApplicationPluginConfig } from '@gauzy/common';
import { DatabaseTypeEnum } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { registerPluginConfig } from '../bootstrap';
import { IMigrationOptions } from './migration-interface';
import { MigrationUtils } from './migration-utils';
import { isDatabaseType, isSqliteDB } from './../core/utils';

/**
 * @description
 * Run pending database migrations. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 *
 * @param pluginConfig - Partial application plugin config
 */
export async function runDatabaseMigrations(pluginConfig: Partial<ApplicationPluginConfig>): Promise<void> {
	const config = await registerPluginConfig(pluginConfig);
	const dataSource = await initializeDatabaseConnection(config);

	try {
		const migrations = await dataSource.runMigrations({ transaction: 'each' });

		if (isNotEmpty(migrations)) {
			migrations.forEach((migration) => {
				console.log(chalk.green(`Migration ${migration.name} has been run successfully!`));
			});
		} else {
			console.log(chalk.yellow(`There are no pending migrations to run.`));
		}
	} catch (error) {
		console.error(chalk.black.bgRed('Error during migration run:'));
		console.error(error);
		process.exit(1);
	} finally {
		await shutdownDatabaseConnection(dataSource);
	}
}

/**
 * @description
 * Reverts last applied database migration. See [TypeORM migration docs](https://typeorm.io/#/migrations)
 *
 * @param pluginConfig - Partial application plugin config
 */
export async function revertLastDatabaseMigration(pluginConfig: Partial<ApplicationPluginConfig>): Promise<void> {
	const config = await registerPluginConfig(pluginConfig);
	const dataSource = await initializeDatabaseConnection(config);

	try {
		await dataSource.undoLastMigration({ transaction: 'each' });
		console.log(chalk.green('Last migration has been reverted successfully!'));
	} catch (error) {
		console.error(chalk.black.bgRed('Error during migration revert:'));
		console.error(error);
		process.exit(1);
	} finally {
		await shutdownDatabaseConnection(dataSource);
	}
}

/**
 * @description
 * Generates a new migration file with SQL required to update the schema.
 *
 * @param pluginConfig - Partial application plugin configuration
 * @param options - Migration generation options including name and output directory
 */
export async function generateMigration(
	pluginConfig: Partial<ApplicationPluginConfig>,
	options: IMigrationOptions
): Promise<void> {
	if (!options.name) {
		console.log(chalk.yellow('Migration name must be required.Please specify migration name!'));
		return;
	}
	const config = await registerPluginConfig(pluginConfig);
	const dataSource = await initializeDatabaseConnection(config);
	const directory = resolveMigrationDirectory(options, config);

	try {
		const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
		const upSqls: string[] = [];
		const downSqls: string[] = [];

		sqlInMemory.upQueries.forEach((upQuery) => {
			upSqls.push(
				'await queryRunner.query(`' +
					upQuery.query.replace(new RegExp('`', 'g'), '\\`') +
					'`' +
					queryParams(upQuery.parameters) +
					');'
			);
		});
		sqlInMemory.downQueries.forEach((downQuery) => {
			downSqls.push(
				'await queryRunner.query(`' +
					downQuery.query.replace(new RegExp('`', 'g'), '\\`') +
					'`' +
					queryParams(downQuery.parameters) +
					');'
			);
		});

		if (upSqls.length) {
			const timestamp = new Date().getTime();
			/**
			 *  Gets contents of the migration file.
			 */
			const fileContent = getTemplate(dataSource, options.name as any, timestamp, upSqls, downSqls.reverse());

			const filename = timestamp + '-' + options.name + '.ts';
			const outputPath = directory ? path.join(directory, filename) : path.join(process.cwd(), filename);

			try {
				await MigrationUtils.createFile(outputPath, fileContent);
				console.log(chalk.green(`Migration ${chalk.blue(outputPath)} has been generated successfully.`));
			} catch (error) {
				console.log(chalk.black.bgRed('Error during migration generating files:'));
				console.error(error);
			}
		} else {
			console.log(
				chalk.yellow(
					`No changes in database schema were found - cannot generate a migration. To create a new empty migration use "yarn run migration:create" command`
				)
			);
		}
	} catch (error) {
		console.error(chalk.red('❌ Error during migration generation:'));
		console.error(error);
		process.exit(1);
	} finally {
		await shutdownDatabaseConnection(dataSource);
	}
}

/**
 * Resolves the directory where migration files should be generated.
 *
 * @param options - Migration options that may include a `dir` path
 * @param config - Plugin configuration containing possible CLI migration settings
 * @returns The resolved directory path or `undefined` if not found
 */
export function resolveMigrationDirectory(
	options: IMigrationOptions,
	config: Partial<ApplicationPluginConfig>
): string | undefined {
	if (options.dir) {
		return options.dir;
	}

	try {
		return config.dbConnectionOptions && config.dbConnectionOptions['cli']
			? config.dbConnectionOptions['cli']['migrationsDir']
			: undefined;
	} catch (err) {
		console.error(chalk.red('❌ Error while resolving migration directory:'), err);
		return undefined;
	}
}

/**
 * @description
 * Creates a new blank migration file to be used for schema changes.
 *
 * @param pluginConfig - Partial application plugin configuration
 * @param options - Migration creation options including name and optional directory
 */
export async function createMigration(
	pluginConfig: Partial<ApplicationPluginConfig>,
	options: IMigrationOptions
): Promise<void> {
	if (!options.name) {
		console.log(chalk.yellow('Migration name is required. Please specify a name using "--name".'));
		return;
	}

	const config = await registerPluginConfig(pluginConfig);
	const dataSource = await initializeDatabaseConnection(config);
	const directory = resolveMigrationDirectory(options, config);

	try {
		const timestamp = Date.now();
		const fileContent = getTemplate(dataSource, options.name, timestamp, [], []);
		const filename = `${timestamp}-${options.name}.ts`;
		const outputPath = directory ? path.join(directory, filename) : path.join(process.cwd(), filename);

		await MigrationUtils.createFile(outputPath, fileContent);
		console.log(chalk.green(`Migration ${chalk.blue(outputPath)} has been created successfully.`));
	} catch (error) {
		console.error(chalk.red('❌ Error while creating migration file:'));
		console.error(error);
		process.exit(1);
	} finally {
		await shutdownDatabaseConnection(dataSource);
	}
}

/**
 * @description
 * Initializes a new database connection. See [TypeORM migration docs](https://typeorm.io/#/connection)
 *
 * @param config - Partial application plugin configuration
 * @returns An initialized TypeORM DataSource instance
 */
export async function initializeDatabaseConnection(config: Partial<ApplicationPluginConfig>): Promise<DataSource> {
	const { dbConnectionOptions } = config;

	if (!dbConnectionOptions) {
		throw new Error('❌ Missing database connection options in plugin config.');
	}

	const dataSource = new DataSource({
		...dbConnectionOptions,
		subscribers: [],
		synchronize: false,
		migrationsRun: false,
		dropSchema: false
	} as DataSourceOptions);

	console.log(chalk.yellow('NOTE: No existing database connection found. Creating a new one...'));

	try {
		if (!dataSource.isInitialized) {
			console.log(chalk.blue('Connecting to the database...'));
			await dataSource.initialize();
			console.log(chalk.green('✅ Successfully connected to the database.'));
		}
	} catch (error) {
		console.error(chalk.red('❌ Failed to connect to the database:'), error);
		process.exit(1);
	}

	return dataSource;
}

/**
 * @description
 * Gracefully shuts down the database connection after use.
 *
 * @param dataSource - An initialized TypeORM DataSource
 */
export async function shutdownDatabaseConnection(dataSource: DataSource): Promise<void> {
	if (!dataSource || !dataSource.isInitialized) {
		console.log(chalk.yellow('⚠️ Database connection is not initialized or already closed.'));
		return;
	}

	try {
		await dataSource.destroy();
		console.log(chalk.green('✅ Database connection closed successfully.'));
	} catch (error) {
		console.error(chalk.red('❌ Failed to close the database connection:'), error);
	}
}

/**
 * Formats query parameters for migration queries if parameters actually exist
 */
function queryParams(parameters: any[] | undefined): string {
	if (!parameters || !parameters.length) {
		return '';
	}

	return `, ${JSON.stringify(parameters)}`;
}

/**
 * Gets contents of the migration file.
 */
function getTemplate(
	connection: DataSource,
	name: string,
	timestamp: number,
	upSqls: string[],
	downSqls: string[]
): string {
	return `import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
        ${
			isDatabaseType([DatabaseTypeEnum.postgres], connection.options)
				? upSqls.join(`
        `)
				: [].join(`
        `)
		}
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${
			isDatabaseType([DatabaseTypeEnum.postgres], connection.options)
				? downSqls.join(`
        `)
				: [].join(`
        `)
		}
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${
			isSqliteDB(connection.options)
				? upSqls.join(`
        `)
				: [].join(`
        `)
		}
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${
			isSqliteDB(connection.options)
				? downSqls.join(`
        `)
				: [].join(`
        `)
		}
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.mysql], connection.options) ? upSqls.join(``) : [].join(``)}
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        ${isDatabaseType([DatabaseTypeEnum.mysql], connection.options) ? downSqls.join(``) : [].join(``)}
    }
}
`;
}
