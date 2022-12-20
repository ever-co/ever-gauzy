import { IDatabaseProvider } from '../../interfaces/i-database-provider';
import { Knex } from 'knex';

export class MysqlProvider implements IDatabaseProvider {
	private _connectionConfig: Knex.StaticConnectionConfig;
	private static _instance: IDatabaseProvider;
	private _connection: Knex;
	private _database: string;

	private constructor() {
		this._initialization();
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'mysql connected...');
	}

	public get config(): Knex.Config {
		return {
			client: 'mysql',
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

	public static get instance(): IDatabaseProvider {
		if (!MysqlProvider._instance) {
			MysqlProvider._instance = new MysqlProvider();
		}
		return MysqlProvider._instance;
	}

	private _initialization() {
		this._database = 'gauzy_desktop_timer';
		this._connectionConfig = {
			host: '127.0.0.1',
			port: 3306,
			user: 'root',
			password: ''
		};
		(async () => {
			try {
				const connection: Knex = require('knex')({
					client: 'mysql',
					connection: this._connectionConfig
				});
				await connection
					.raw('CREATE DATABASE IF NOT EXISTS ??', this._database)
					.finally(async () => {
						await connection.destroy();
					});
			} catch (error) {
				console.error('[provider-error]', error);
			}
		})();
	}

	public get connection(): Knex {
		return this._connection;
	}
}
