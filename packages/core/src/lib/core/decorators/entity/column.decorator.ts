import { PrimaryKey as MikroORMPrimaryKey, Property as MikroORMColumn } from '@mikro-orm/core';
import { Column as TypeORMColumn } from 'typeorm';
import { isObject } from '@gauzy/utils';
import { ColumnDataType, ColumnOptions } from './column-options.types';
import { parseMikroOrmColumnOptions, resolveDbType } from './column.helper';
import { MultiORMEnum, getORMType } from '../../utils';

/**
 * Decorator for creating column definitions for both MikroORM and TypeORM.
 *
 * **TypeORM's metadata is registered under both ORMs; MikroORM's only under `DB_ORM=mikro-orm`.** The
 * TypeORM `DataSource` is initialised whichever ORM is active: it runs the migrations, the seeder writes
 * through it, and so does every service that still reads or writes with TypeORM (the ever-async
 * integration's bootstrap, the platform plugins' TypeORM arms). Registering TypeORM's column only under
 * `DB_ORM=typeorm` left it a skeleton of the base columns under MikroORM, so each of those writes was
 * `INSERT INTO "role"("deletedAt", "createdAt", "updatedAt", "id")` and failed `NOT NULL` on the first real
 * column — the API could neither seed nor boot on MikroORM. Under `DB_ORM=typeorm` nothing changes:
 * MikroORM's decorator stays off, because MikroORM is initialised in that mode too and validates every
 * property registered for it. The TypeORM decorator is applied first, from a copy of the options, because
 * `parseMikroOrmColumnOptions` rewrites `default` and `persist` on the options it is given.
 *
 * The relation decorators, `@ColumnIndex`, `@JsonColumn` and the entity-level unique constraints follow
 * the same rule.
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

		// TypeORM's column under every ORM (see above): its DataSource runs in both modes.
		// `hidden` is MikroORM-only (it drops the property from `wrap(entity).toJSON()`); TypeORM has
		// no such column option, so it is not forwarded there.
		const { hidden: _hidden, ...typeOrmOptions } = options;
		TypeORMColumn({ type, ...typeOrmOptions })(target, propertyKey);

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
