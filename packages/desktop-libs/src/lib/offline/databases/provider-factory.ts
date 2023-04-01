import { DatabaseProviderContext } from '../../contexts/database-provider-context';
import { IDatabaseProvider } from '../../interfaces/i-database-provider';
import { SqliteProvider } from './sqlite-provider';
import { Knex } from 'knex';
import { PostgresProvider } from './postgres-provider';
import { MysqlProvider } from './mysql-provider';
import { LocalStore } from '../../desktop-store';

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
			default:
				this._dbContext.provider = SqliteProvider.instance;
				break;
		}
	}

	public get dialect(): string {
		const cfg = LocalStore.getApplicationConfig().config;
		return cfg && cfg.db ? cfg.db : 'sqlite';
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
			.catch((error) => console.log('Migration failed... 😞', error))
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
		await this.connection.destroy();
		ProviderFactory._instance = null;
	}
}
