import { IDatabaseProvider } from '../../interfaces/i-database-provider';
import { Knex } from 'knex';
import path from 'path';
import { app } from 'electron';

export class SqliteProvider implements IDatabaseProvider {
	private static _instance: IDatabaseProvider;
	private _connection: Knex;

	private constructor() {
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'slqlite connected...');
	}
	get config(): Knex.Config {
		return {
			client: 'sqlite3',
			connection: {
				filename: path.resolve(app.getPath('userData'), 'gauzy.sqlite3')
			},
			pool: {
				min: 2,
				max: 5,
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
			debug: true,
			asyncStackTraces: true
		};
	}

	public get connection(): Knex {
		return this._connection;
	}

	public static get instance(): IDatabaseProvider {
		if (!this._instance) {
			this._instance = new SqliteProvider();
		}
		return this._instance;
	}
}
