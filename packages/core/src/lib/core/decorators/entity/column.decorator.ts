import { Property as MikroORMColumn } from '@mikro-orm/core';
import { Column as TypeORMColumn } from 'typeorm';
import { isObject } from '@gauzy/utils';
import { ColumnDataType, ColumnOptions } from './column-options.types';
import { parseMikroOrmColumnOptions, resolveDbType } from './column.helper';
import { MultiORMEnum, getORMType } from '../../utils';

/**
 * Decorator for creating column definitions for both MikroORM and TypeORM.
 * Applies only the active ORM's decorator based on the DB_ORM environment variable.
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
		// Determine which ORM is in use
		const ormType = getORMType();

		// Apply TypeORM decorator when using TypeORM
		if (ormType === MultiORMEnum.TypeORM) {
			TypeORMColumn({ type, ...options })(target, propertyKey);
		}

		// Apply MikroORM decorator when using MikroORM
		if (ormType === MultiORMEnum.MikroORM) {
			MikroORMColumn(parseMikroOrmColumnOptions({ type, options }))(target, propertyKey);
		}
	};
}
