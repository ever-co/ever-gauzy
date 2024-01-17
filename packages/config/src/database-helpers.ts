import { TlsOptions } from "tls";
import { parseToBoolean } from '@gauzy/common';

export enum databaseTypes {
	mongodb = 'mongodb',
	sqlite = 'sqlite',
	betterSqlite3 = 'better-sqlite3',
	postgres = 'postgres',
	mysql = 'mysql'
}

const isMysqlValue = process.env.DB_TYPE === databaseTypes.mysql
const isSqliteValue = process.env.DB_TYPE === databaseTypes.sqlite
const isBetterSqlite3Value = process.env.DB_TYPE === databaseTypes.betterSqlite3
const isPostgresValue = process.env.DB_TYPE === databaseTypes.postgres
const isMongodbValue = process.env.DB_TYPE === databaseTypes.mongodb

export const isMySQL = (): boolean => isMysqlValue;
export const isSqlite = (): boolean => isSqliteValue;
export const isBetterSqlite3 = (): boolean => isBetterSqlite3Value;
export const isPostgres = (): boolean => isPostgresValue;
export const isMongodb = (): boolean => isMongodbValue;

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
export const prepareSQLQuery = (queryStr: string): string => {
	if (isMySQL()) {
		return queryStr.replace(/"/g, '`');
	}
	return queryStr;
}
