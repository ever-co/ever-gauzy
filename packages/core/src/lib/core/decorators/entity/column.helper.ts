import { DataSourceOptions } from 'typeorm';
import { ColumnDataType, MikroORMColumnOptions } from './column-options.types';

/**
 * Resolve the database column type.
 * @param columnType - The input column type.
 * @returns The resolved column type.
 */
export function resolveDbType(columnType: ColumnDataType): ColumnDataType {
	return columnType;
}

/**
 * Maps a generic type to a database-specific column type based on the provided database engine.
 *
 * @param dbEngine - The type of the database engine.
 * @param type - The generic type to be mapped.
 * @returns The database-specific column type.
 */
export function getColumnType(dbEngine: DataSourceOptions['type'], type: string): ColumnDataType {
	switch (type) {
		case 'string':
			return 'varchar';
	}
	return 'varchar';
}

/**
 * Parse MikroORM column options.
 * @param param0 - The options for parsing column arguments.
 * @returns MikroORM column options.
 */
export function parseMikroOrmColumnOptions<T>({ type, options }): MikroORMColumnOptions<T> {
	if (typeof options?.default === 'function') {
		options.default = options.default();
	}
	if (options?.relationId) {
		options.persist = false;
	}
	return {
		type: type,
		...options
	};
}
