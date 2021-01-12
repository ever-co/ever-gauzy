import * as path from 'path';

let defaultConnection = process.env.DB_TYPE || 'postgres';

export const connnections = {
	postgres: {
		type: 'postgres',
		host: process.env.DB_HOST || 'localhost',
		port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
		database: process.env.DB_NAME || 'postgres',
		username: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASS || 'root',
		keepConnectionAlive: true,
		logging: true,
		logger: 'file',
		synchronize: true,
		uuidExtension: 'pgcrypto'
	},
	mysql: {
		type: 'mysql',
		host: process.env.DB_HOST || 'localhost',
		port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
		database: process.env.DB_NAME || 'mysql',
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASS || 'root',
		keepConnectionAlive: true,
		logging: true,
		logger: 'file',
		synchronize: true
	},
	sqlite: {
		type: 'sqlite',
		database:
			process.env.DB_PATH || path.join(process.cwd(), 'gauzy.sqlite'),
		keepConnectionAlive: true,
		logging: true,
		logger: 'file',
		synchronize: true
	}
};

export function getConnectionOptions(connection: string) {
	return connnections[defaultConnection];
}

export let dbConnectionConfig = getConnectionOptions(defaultConnection);
