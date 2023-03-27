import { IServerLessProvider } from '../../interfaces';
import { Knex } from 'knex';
import path from 'path';
import { app } from 'electron';

export class SqliteProvider implements IServerLessProvider {
	private static _instance: IServerLessProvider;
	private _connection: Knex;

	private constructor() {
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'sqlite connected...');
	}
	get config(): Knex.Config {
		return {
			client: 'sqlite3',
			connection: {
				filename: path.resolve(app.getPath('userData'), 'gauzy.sqlite3'),
				timezone: 'utc'
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
			debug: false,
			asyncStackTraces: true
		};
	}

	public get connection(): Knex {
		return this._connection;
	}

	public static get instance(): IServerLessProvider {
		if (!this._instance) {
			this._instance = new SqliteProvider();
		}
		return this._instance;
	}
}
