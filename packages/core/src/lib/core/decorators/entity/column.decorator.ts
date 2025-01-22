import { Property as MikroORMColumn } from '@mikro-orm/core';
import { Column as TypeORMColumn } from 'typeorm';
import { isObject } from '@gauzy/utils';
import { ColumnDataType, ColumnOptions } from './column-options.types';
import { parseMikroOrmColumnOptions, resolveDbType } from './column.helper';

/**
 * Decorator for creating column definitions for both MikroORM and TypeORM.
 *
 * @template T - The type of the column.
 * @param typeOrOptions - The column type or additional options if provided.
 * @param options - The options for the column.
 * @returns PropertyDecorator.
 */
export function MultiORMColumn<T>(
	typeOrOptions?: ColumnDataType | ColumnOptions<T>,
	options?: ColumnOptions<T>
): PropertyDecorator {
	// normalize parameters
	let type: ColumnDataType | undefined;

	if (typeof typeOrOptions === 'string' || typeof typeOrOptions === 'function') {
		// If typeOrOptions is a string or function, set 'type' to the resolved type and 'options' to an empty object.
		type = resolveDbType(typeOrOptions);
	} else if (isObject(typeOrOptions)) {
		// If typeOrOptions is an object, assume it is 'options' and set 'type' accordingly.
		options = <ColumnOptions<T>>typeOrOptions;
		type = resolveDbType(options.type);
	}

	// Ensure 'options' is initialized to an empty object if it is null or undefined.
	if (!options) options = {} as ColumnOptions<T>;

	return (target: any, propertyKey: string) => {
		TypeORMColumn({ type, ...options })(target, propertyKey);
		MikroORMColumn(parseMikroOrmColumnOptions({ type, options }))(target, propertyKey);
	};
}
