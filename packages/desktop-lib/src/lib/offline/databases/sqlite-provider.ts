import { IServerLessProvider } from '../../interfaces';
import { Knex } from 'knex';
import * as path from 'path';
import { app } from 'electron';
import { DatabaseTypeEnum } from '@gauzy/config';

export class SqliteProvider implements IServerLessProvider {
	private static _instance: IServerLessProvider;
	private _connection: Knex;

	private constructor() {
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'SQlite connected...');
	}

	public static get instance(): IServerLessProvider {
		if (!this._instance) {
			this._instance = new SqliteProvider();
		}
		return this._instance;
	}

	public get connection(): Knex {
		return this._connection;
	}

	public get config(): Knex.Config {
		return {
			// Here we can use 'sqlite' if we want native SQlite3 driver
			// But we need to install it manually and instead we prefer to use 'better-sqlite3'
			client: DatabaseTypeEnum.betterSqlite3,
			connection: {
				filename: path.resolve(app?.getPath('userData') || __dirname, 'gauzy.sqlite3'),
				timezone: 'utc'
			},
			pool: {
				min: 0,
				max: 1,
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
}
