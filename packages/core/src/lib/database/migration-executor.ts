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
 * Executes all pending database migrations using TypeORM for the provided plugin configuration.
 *
 * Applies each migration in a separate transaction and logs the outcome. If no migrations are pending, a warning is logged.
 *
 * @param pluginConfig - Partial plugin configuration specifying database connection details.
 *
 * @remark
 * If an error occurs during migration execution, the process will terminate with a failure exit code after logging the error.
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
 * Reverts the most recently applied database migration using TypeORM.
 *
 * Applies the revert operation within a transaction for each migration step. Logs success or error messages and ensures the database connection is properly closed after the operation.
 *
 * @param pluginConfig - Partial plugin configuration containing database connection details.
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
 * Generates a new migration file containing SQL statements to update the database schema based on detected changes.
 *
 * If no schema changes are detected, no migration file is created and a warning is logged.
 *
 * @param pluginConfig - Partial plugin configuration used to initialize the database connection.
 * @param options - Migration generation options, including the migration name and output directory.
 *
 * @remark
 * Exits the process with a failure code if an error occurs during migration generation.
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
 * Determines the directory path for generating migration files based on provided options or plugin configuration.
 *
 * @param options - Migration options that may specify a target directory.
 * @param config - Plugin configuration that may include CLI migration directory settings.
 * @returns The directory path for migration files, or `undefined` if it cannot be determined.
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
 * Creates a new blank migration file with the specified name and directory.
 *
 * Generates a timestamped TypeScript migration file containing empty `up` and `down` methods, ready for manual schema changes.
 *
 * @param options - Migration creation options, including the migration name and optional output directory.
 *
 * @remark
 * If the migration name is not provided in {@link options}, the function logs a warning and does not create a file.
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
 * Initializes and returns a new TypeORM DataSource using the provided plugin configuration.
 *
 * @param config - Plugin configuration containing database connection options.
 * @returns The initialized TypeORM DataSource instance.
 *
 * @throws {Error} If database connection options are missing in {@link config}.
 * @remark Exits the process if the database connection fails to initialize.
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
 * Closes an active TypeORM database connection if it is initialized.
 *
 * Logs a warning if the connection is not initialized or already closed.
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
 * Generates a TypeScript migration class template for TypeORM with database-specific up and down methods.
 *
 * The generated class includes methods for applying and reverting schema changes for supported databases (Postgres, SQLite, MySQL), with SQL statements provided for each direction.
 *
 * @param connection - The TypeORM DataSource used to determine the database type.
 * @param name - The base name for the migration class.
 * @param timestamp - A timestamp to ensure the migration class name is unique.
 * @param upSqls - SQL statements to execute when applying the migration.
 * @param downSqls - SQL statements to execute when reverting the migration.
 * @returns The contents of the migration file as a TypeScript string.
 *
 * @throws {Error} If the generated migration is run on an unsupported database type.
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
