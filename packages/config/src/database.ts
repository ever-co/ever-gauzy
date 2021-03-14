import * as path from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConnectionOptions } from 'typeorm';

const defaultConnection =
	process.env.DB_TYPE && process.env.DB_TYPE === 'postgres'
		? 'postgres'
		: 'sqlite';

const dbPath =
	process.env.DB_PATH ||
	path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');

console.log('Sqlite DB Path: ' + dbPath);

const ssl = process.env.DB_SSL_MODE === 'true' ? true : undefined;

const postgreSQLConfig: ConnectionOptions = {
	type: 'postgres',
	host: process.env.DB_HOST || 'localhost',
	port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
	database: process.env.DB_NAME || 'postgres',
	username: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASS || 'root',
	ssl: ssl,
	logging: true,
	logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
	synchronize: true,
	uuidExtension: 'pgcrypto'
};

const sqliteConfig: ConnectionOptions = {
	type: 'sqlite',
	database: dbPath,
	logging: true,
	logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
	synchronize: true
};

export const connections = {
	postgres: postgreSQLConfig,
	sqlite: sqliteConfig
};

export function getConnectionOptions(connection: string) {
	return connections[connection];
}

export const dbConnectionConfig = getConnectionOptions(
	defaultConnection
) as TypeOrmModuleOptions;
