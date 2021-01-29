import * as path from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const defaultConnection =
	process.env.DB_TYPE && process.env.DB_TYPE === 'postgres'
		? 'postgres'
		: 'sqlite';

export const connections = {
	postgres: {
		type: 'postgres',
		host: process.env.DB_HOST || 'localhost',
		port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
		database: process.env.DB_NAME || 'postgres',
		username: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASS || 'root',
		keepConnectionAlive: true,
		logging: true,
		logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
		synchronize: true,
		uuidExtension: 'pgcrypto'
	},
	sqlite: {
		type: 'sqlite',
		database:
			process.env.DB_PATH ||
			path.join(
				process.cwd(),
				...['apps', 'api', 'data'],
				'gauzy.sqlite'
			),
		keepConnectionAlive: true,
		logging: true,
		logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
		synchronize: true
	}
};

export function getConnectionOptions(connection: string) {
	return connections[connection];
}

export const dbConnectionConfig = getConnectionOptions(
	defaultConnection
) as TypeOrmModuleOptions;
