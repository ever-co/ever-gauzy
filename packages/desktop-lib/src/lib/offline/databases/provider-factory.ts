import { DatabaseProviderContext } from '../../contexts/database-provider-context';
import { IDatabaseProvider } from '../../interfaces/i-database-provider';
import { SqliteProvider } from './sqlite-provider';
import { Knex } from 'knex';
import { PostgresProvider } from './postgres-provider';
import { MysqlProvider } from './mysql-provider';
import { LocalStore } from '../../desktop-store';
import { AppError } from '../../error-handler';
import { BetterSqliteProvider } from './better-sqlite-provider';

export class ProviderFactory implements IDatabaseProvider {
	private _dbContext: DatabaseProviderContext;
	private static _instance: ProviderFactory;

	private constructor() {
		this._dbContext = new DatabaseProviderContext();
		this._defineProvider();
	}

	public get config(): Knex.Config<any> {
		this._defineProvider();
		return this._dbContext.provider.config;
	}

	public get connection(): Knex {
		this._defineProvider();
		return this._dbContext.provider.connection;
	}

	private _defineProvider() {
		switch (this.dialect) {
			case 'postgres':
				this._dbContext.provider = PostgresProvider.instance;
				break;
			case 'mysql':
				this._dbContext.provider = MysqlProvider.instance;
				break;
			case 'sqlite':
				this._dbContext.provider = SqliteProvider.instance;
				break;
			default:
				this._dbContext.provider = BetterSqliteProvider.instance;
				break;
		}
	}

	public get dialect(): string {
		let cfg = LocalStore.getApplicationConfig().config;
		if (!cfg?.db) {
			// Set default database
			LocalStore.updateAdditionalSetting({ db: 'better-sqlite' });
			cfg = LocalStore.getApplicationConfig().config;
		}
		return cfg?.db;
	}

	public async migrate(): Promise<void> {
		const connection = require('knex')(this.config);
		await connection.migrate
			.latest()
			.then(([, log]) => {
				if (!log.length) {
					console.info('Database is already up to date...✅');
				} else {
					console.info('⚓️ Ran migrations: ' + log.join(', '));
					console.log('Migration completed... 💯');
				}
			})
			.catch((error) => { throw new AppError('PRMIG', error) })
			.finally(async () => {
				await connection.destroy();
			});
	}

	public static get instance(): ProviderFactory {
		if (!this._instance) {
			this._instance = new ProviderFactory();
		}
		return this._instance;
	}

	public async createDatabase(): Promise<void> {
		if ('createDatabase' in this._dbContext.provider) {
			await this._dbContext.provider.createDatabase();
		}
	}

	public async kill(): Promise<void> {
		try {
			await this.connection.destroy();
			ProviderFactory._instance = null;
		} catch (error) {
			throw new AppError('PRKILL', error);
		}
	}

	public async check(arg: any): Promise<string> {
		const dialect = arg.db;
		const connection = {
			host: arg[dialect]?.dbHost,
			user: arg[dialect]?.dbUsername,
			password: arg[dialect]?.dbPassword,
			database: arg[dialect]?.dbName,
			port: arg[dialect]?.dbPort,
		};
		let databaseOptions: Knex.Config = {};
		let driver = '';
		switch (dialect) {
			case 'postgres':
				driver = 'PostgresSQL';
				databaseOptions = {
					client: 'pg',
					connection,
				};
				break;
			case 'mysql':
				driver = 'MySQL';
				databaseOptions = {
					client: 'mysql',
					connection,
				};
				break;
			case 'sqlite':
				driver = 'SQLite';
				databaseOptions = SqliteProvider.instance.config;
				break;
			default:
				driver = 'Better SQLite 3';
				databaseOptions = BetterSqliteProvider.instance.config;
				break;
		}
		const instance = require('knex')(databaseOptions);
		await instance.raw('SELECT 1');
		await instance.destroy();
		return driver;
	}
}
