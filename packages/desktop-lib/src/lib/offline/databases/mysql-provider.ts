import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { LocalStore } from '../../desktop-store';
import { IClientServerProvider } from '../../interfaces';

export class MysqlProvider implements IClientServerProvider {
	private _connectionConfig: Knex.StaticConnectionConfig;
	private static _instance: IClientServerProvider;
	private _connection: Knex;
	private _database: string;
	private readonly CLIENT = 'mysql2';

	private constructor() {
		this._initialization();
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'mysql connected...');
	}

	public get config(): Knex.Config {
		return {
			client: this.CLIENT,
			connection: {
				...this._connectionConfig,
				database: this._database
			},
			migrations: {
				directory: __dirname + '/migrations'
			},
			pool: {
				min: 2,
				max: 15,
				createTimeoutMillis: 3000,
				acquireTimeoutMillis: 60 * 1000 * 2,
				idleTimeoutMillis: 30000,
				reapIntervalMillis: 1000,
				createRetryIntervalMillis: 100
			},
			useNullAsDefault: true,
			asyncStackTraces: true
		};
	}

	public static get instance(): IClientServerProvider {
		if (!MysqlProvider._instance) {
			MysqlProvider._instance = new MysqlProvider();
		}
		return MysqlProvider._instance;
	}

	private _initialization() {
		this._database = 'gauzy_timer_db';
		const cfg = LocalStore.getApplicationConfig().config['mysql'];
		this._connectionConfig = {
			host: cfg.dbHost,
			port: cfg.dbPort,
			user: cfg.dbUsername,
			password: cfg.dbPassword
		};
	}

	public async createDatabase() {
		try {
			const connection: Knex = require('knex')({
				client: this.CLIENT,
				connection: this._connectionConfig
			});
			await connection.raw('CREATE DATABASE IF NOT EXISTS ??', this._database).finally(async () => {
				await connection.destroy();
			});
		} catch (error) {
			throw new AppError('MYSQL', error);
		}
	}

	public get connection(): Knex {
		return this._connection;
	}
}
