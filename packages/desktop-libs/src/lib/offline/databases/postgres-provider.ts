import { IDatabaseProvider } from '../../interfaces/i-database-provider';
import { Knex } from 'knex';
import { LocalStore } from '../../desktop-store';

export class PostgresProvider implements IDatabaseProvider {
	private static _instance: IDatabaseProvider;
	private _connection: Knex;

	private constructor() {
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'postgres connected...');
	}

	public get config(): Knex.Config<any> {
		const cfg = LocalStore.getApplicationConfig().config;
		return {
			client: 'pg',
			connection: {
				host: cfg.dbHost,
				port: cfg.dbPort,
				user: cfg.dbUsername,
				password: cfg.dbPassword,
				database: 'db_gauzy_timer'
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
			migrations: {
				directory: __dirname + '/migrations'
			},
			useNullAsDefault: true,
			asyncStackTraces: true
		};
	}

	public static get instance(): IDatabaseProvider {
		if (!PostgresProvider._instance) {
			PostgresProvider._instance = new PostgresProvider();
		}
		return PostgresProvider._instance;
	}

	public get connection(): Knex {
		return this._connection;
	}
}
