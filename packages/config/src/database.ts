import * as path from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConnectionOptions } from 'typeorm';

const dbType =
	process.env.DB_TYPE && process.env.DB_TYPE === 'postgres'
		? 'postgres'
		: 'sqlite';

console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);

let connectionConfig: TypeOrmModuleOptions;

if (dbType === 'sqlite') {

	const dbPath =
		process.env.DB_PATH ||
		path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');

	console.log('Sqlite DB Path: ' + dbPath);	

	const sqliteConfig: ConnectionOptions = {
		type: 'sqlite',
		database: dbPath,
		logging: true,
		logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
		synchronize: true
	};

	connectionConfig = sqliteConfig;

} else if (dbType === 'postgres') {

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

	connectionConfig = postgreSQLConfig;

}

export const dbConnectionConfig = connectionConfig;
