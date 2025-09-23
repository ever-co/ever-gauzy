import { isBetterSqlite3, isSqlite } from '@gauzy/config';

/**
 * Database serialization utilities for handling JSON data across different database types
 * SQLite requires JSON to be stored as strings, while PostgreSQL/MySQL can handle objects directly
 */

/**
 * Checks if the current database requires JSON serialization (SQLite variants)
 * @returns true if database needs JSON serialization, false otherwise
 */
export function requiresJsonSerialization(): boolean {
	return isSqlite() || isBetterSqlite3();
}

/**
 *  Serializes data for database storage
 * Converts objects to JSON strings for SQLite, leaves as-is for other databases
 * @param data - The data to serialize
 * @returns Serialized data (string for SQLite, original object for others)
 */
export function stringifyForDatabase<T = any>(data: T): string | T {
	if (data === null || data === undefined) {
		return data;
	}

	if (requiresJsonSerialization()) {
		try {
			if (typeof data === 'string') {
				return data;
			}
			return JSON.stringify(data);
		} catch (error) {
			throw new Error(`Database serialization failed: ${error.message}`);
		}
	}

	return data;
}

/**
 * Parse data from database storage
 * Parses JSON strings from SQLite, returns as-is for other databases
 * @param data - The data to parse
 * @returns Parsed data
 */
export function parseFromDatabase<T = any>(data: any): T | null {
	if (data === null || data === undefined) {
		return null;
	}

	if (requiresJsonSerialization() && typeof data === 'string') {
		try {
			return JSON.parse(data) as T;
		} catch (error) {
			return null;
		}
	}

	return data as T;
}
