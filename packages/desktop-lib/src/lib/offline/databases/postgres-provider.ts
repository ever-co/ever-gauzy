import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { LocalStore } from '../../desktop-store';
import { IClientServerProvider } from '../../interfaces';

export class PostgresProvider implements IClientServerProvider {
	private _connectionConfig: Knex.StaticConnectionConfig;
	private static _instance: IClientServerProvider;
	private _connection: Knex;
	private _database: string;

	private constructor() {
		this._initialization();
		this._connection = require('knex')(this.config);
		console.log('[provider]: ', 'postgres connected...');
	}

	public get config(): Knex.Config<any> {
		return {
			client: 'pg',
			connection: {
				...this._connectionConfig,
				database: this._database,
			},
			migrations: {
				directory: __dirname + '/migrations',
			},
			pool: {
				min: 2,
				max: 15,
				createTimeoutMillis: 3000,
				acquireTimeoutMillis: 60 * 1000 * 2,
				idleTimeoutMillis: 30000,
				reapIntervalMillis: 1000,
				createRetryIntervalMillis: 100,
			},
			useNullAsDefault: true,
			asyncStackTraces: true,
		};
	}

	private _initialization() {
		this._database = 'gauzy_timer_db';
		const cfg = LocalStore.getApplicationConfig().config['postgres'];
		this._connectionConfig = {
			host: cfg.dbHost,
			port: cfg.dbPort,
			user: cfg.dbUsername,
			password: cfg.dbPassword,
			parseInputDatesAsUTC: true
		}
	}

	public async createDatabase() {
		try {
			const connection: Knex = require('knex')({
				client: 'pg',
				connection: this._connectionConfig,
			});
			const res = await connection
				.select('datname')
				.from('pg_database')
				.where('datname', this._database);
			if (res.length < 1) {
				await connection.raw('CREATE DATABASE ??', this._database)
			}
			await connection.destroy();
		} catch (error) {
			throw new AppError('POSTGRES', error);
		}
	}

	public static get instance(): IClientServerProvider {
		if (!PostgresProvider._instance) {
			PostgresProvider._instance = new PostgresProvider();
		}
		return PostgresProvider._instance;
	}

	public get connection(): Knex {
		return this._connection;
	}
}
