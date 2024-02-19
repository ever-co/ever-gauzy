import { TlsOptions } from "tls";

export enum DatabaseTypeEnum {
	mongodb = 'mongodb',
	sqlite = 'sqlite',
	betterSqlite3 = 'better-sqlite3',
	postgres = 'postgres',
	mysql = 'mysql'
}

const isMysqlValue = process.env.DB_TYPE === DatabaseTypeEnum.mysql;
const isSqliteValue = process.env.DB_TYPE === DatabaseTypeEnum.sqlite;
const isBetterSqlite3Value = process.env.DB_TYPE === DatabaseTypeEnum.betterSqlite3;
const isPostgresValue = process.env.DB_TYPE === DatabaseTypeEnum.postgres;
const isMongodbValue = process.env.DB_TYPE === DatabaseTypeEnum.mongodb;

export const isMySQL = (): boolean => isMysqlValue;
export const isSqlite = (): boolean => isSqliteValue;
export const isBetterSqlite3 = (): boolean => isBetterSqlite3Value;
export const isPostgres = (): boolean => isPostgresValue;
export const isMongodb = (): boolean => isMongodbValue;

/**
 * Gets TLS options for a database connection based on the provided SSL mode.
 *
 * @param {string} dbSslMode - The SSL mode for the database connection.
 * @returns {TlsOptions | undefined} - TLS options for the database connection or undefined if SSL is disabled.
 */
export const getTlsOptions = (dbSslMode: boolean): TlsOptions | undefined => {
	// Check if SSL is enabled based on the provided SSL mode
	if (!dbSslMode) {
		// If SSL is not enabled, return undefined
		return undefined;
	}

	// Obtain the CA certificate from the environment variable and decode it
	const base64data = process.env.DB_CA_CERT;
	const buff = Buffer.from(base64data, 'base64');
	const sslCert = buff.toString('ascii');

	// Return TLS options with the decoded CA certificate
	return {
		rejectUnauthorized: true,
		ca: sslCert
	};
};


/**
 * Get logging options based on the provided dbLogging value.
 * @param {string} dbLogging - The value of process.env.DB_LOGGING
 * @returns {false | 'all' | ['query', 'error'] | ['error']} - The logging options
 */
export const getLoggingOptions = (dbLogging: string): false | 'all' | ['query', 'error'] | ['error'] => {
	let loggingOptions: false | 'all' | ['query', 'error'] | ['error'];
	switch (dbLogging) {
		case 'false':
			loggingOptions = false;
			break;
		case 'all':
			loggingOptions = 'all';
			break;
		case 'query':
			loggingOptions = ['query', 'error'];
			break;
		default:
			loggingOptions = ['error'];
	}
	return loggingOptions;
};
