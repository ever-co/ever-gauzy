import { PrimaryKey as MikroORMPrimaryKey, Property as MikroORMColumn } from '@mikro-orm/core';
import { Column as TypeORMColumn } from 'typeorm';
import { isObject } from '@gauzy/utils';
import { ColumnDataType, ColumnOptions } from './column-options.types';
import { parseMikroOrmColumnOptions, resolveDbType } from './column.helper';
import { MultiORMEnum, getORMType } from '../../utils';

/**
 * Decorator for creating column definitions for both MikroORM and TypeORM.
 * Applies only the active ORM's decorator based on the DB_ORM environment variable.
 *
 * `primary` must reach BOTH ORMs, not just TypeORM. The options object is forwarded
 * verbatim to TypeORM's `@Column()`, which understands `primary: true`; the MikroORM side
 * used to always emit a plain `@Property()`, so a column declared
 * `@MultiORMColumn({ primary: true })` gave TypeORM a primary key and MikroORM none, and
 * `discoverEntities` refused to boot the API with
 * `MetadataError: <Entity> is missing @PrimaryKey()`. When `primary` is set we therefore
 * emit MikroORM's `@PrimaryKey()` instead of `@Property()`, with the same mapped options.
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
			// Generic left to inference, as before: `Property()`/`PrimaryKey()` constrain their type
			// parameter to `object`, so an explicit `<T>` (the column's value type) would not fit.
			const mikroOrmOptions = parseMikroOrmColumnOptions({ type, options });

			if (options.primary) {
				// Unlike `Property()`, MikroORM's `PrimaryKey()` does not rename the `name` option
				// to `fieldName` when it differs from the class property (compare the two files in
				// @mikro-orm/core/decorators/) — it would register the property under the database
				// column name instead. Do that rename here so a primary column keeps behaving like
				// every other `@MultiORMColumn`.
				const { name: columnName, ...rest } = mikroOrmOptions;
				MikroORMPrimaryKey(
					columnName && columnName !== propertyKey ? { ...rest, fieldName: columnName } : mikroOrmOptions
				)(target, propertyKey);
			} else {
				MikroORMColumn(mikroOrmOptions)(target, propertyKey);
			}
		}
	};
}
