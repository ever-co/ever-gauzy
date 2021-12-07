import * as path from 'path';
import fs from 'fs';
import { TlsOptions } from 'tls';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConnectionOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

let dbType:string;

if (process.env.DB_TYPE)
	dbType = process.env.DB_TYPE;
else 
	dbType = 'sqlite';	

console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);

let connectionConfig: TypeOrmModuleOptions;

switch (dbType) {

	case 'mongodb':
		throw "MongoDB not supported yet";
 	   
	case 'postgres':

		const ssl = process.env.DB_SSL_MODE === 'true' ? true : undefined;

		let sslParams: TlsOptions;

		if (ssl) {
			const base64data = process.env.DB_CA_CERT;
			const buff = Buffer.from(base64data, 'base64');
			const sslCert = buff.toString('ascii');			

			sslParams = {
				rejectUnauthorized: true,
				ca: sslCert
			}
		}

		const postgresConnectionOptions: PostgresConnectionOptions = {
			type: dbType,
			ssl: ssl ? sslParams : undefined,
			host: process.env.DB_HOST || 'localhost',		
			username: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASS || 'root',
			database: process.env.DB_NAME || 'postgres',
			port: process.env.DB_PORT 
				? parseInt(process.env.DB_PORT, 10)
				: 5432,
			logging: true,
			logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
			uuidExtension: 'pgcrypto'
		};
		
		connectionConfig = postgresConnectionOptions;
		
		break;

	case 'sqlite':

		const dbPath =
			process.env.DB_PATH ||
			path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');

		console.log('Sqlite DB Path: ' + dbPath);

		const sqliteConfig: ConnectionOptions = {
			type: dbType,
			database: dbPath,
			logging: true,
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
		};

		connectionConfig = sqliteConfig;
		
		break;
}

export const dbConnectionConfig = connectionConfig;
