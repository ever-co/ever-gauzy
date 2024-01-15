import { TlsOptions } from "tls";
import { parseToBoolean } from '@gauzy/common';

export enum databaseTypes {
	mongodb = 'mongodb',
	sqlite = 'sqlite',
	betterSqlite3 = 'better-sqlite3',
	postgres = 'postgres',
	mysql = 'mysql'
}

export const isMySQL = (): boolean => process.env.DB_TYPE === databaseTypes.mysql;
export const isSqlite = (): boolean => process.env.DB_TYPE === databaseTypes.sqlite;
export const isBetterSqlite3 = (): boolean => process.env.DB_TYPE === databaseTypes.betterSqlite3;
export const isPostgres = (): boolean => process.env.DB_TYPE === databaseTypes.postgres;
export const isMongodb = (): boolean => process.env.DB_TYPE === databaseTypes.mongodb;

export const getTlsOptions = (dbSslMode: string): TlsOptions | undefined => {
	if (!parseToBoolean(dbSslMode)) return undefined;

	const base64data = process.env.DB_CA_CERT;
	const buff = Buffer.from(base64data, 'base64');
	const sslCert = buff.toString('ascii');
	return {
		rejectUnauthorized: true,
		ca: sslCert
	};
}

/**
 *
 * @Desc Used to replace double quotes " with backticks ` in case the selected DB type is MySQL
 */
export const sanitizeSqlQuotes = (queryStr: string): string => {
	if (isMySQL()) {
		return queryStr.replace(/"/g, '`');
	}
	return queryStr;
}
