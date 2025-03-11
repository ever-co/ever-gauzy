import { Index as TypeOrmIndex, IndexOptions as TypeOrmIndexOptions } from 'typeorm';
import { Index as MikroOrmIndex, IndexOptions as MikroOrmIndexOptions, Unique as MikroUnique } from '@mikro-orm/core';
import { isPlainObject } from '@gauzy/utils';

// Extend your TypeOrmIndexOptions to include MikroOrm options as well
type CombinedIndexOptions<T> =
	| string
	| string[]
	| ((object: any) => any[] | { [key: string]: number })
	| TypeOrmIndexOptions
	| MikroOrmIndexOptions<T>;

export function ColumnIndex<T>(options?: CombinedIndexOptions<T>): ClassDecorator & PropertyDecorator;
export function ColumnIndex<T>(name?: string, options?: CombinedIndexOptions<T>): ClassDecorator & PropertyDecorator;
export function ColumnIndex<T>(
	name: string,
	fields: string[],
	options?: CombinedIndexOptions<T>
): ClassDecorator & PropertyDecorator;
export function ColumnIndex<T>(fields: string[], options?: CombinedIndexOptions<T>): ClassDecorator & PropertyDecorator;

/**
 * ColumnIndex decorator for TypeOrm and MikroOrm.
 *
 * @param nameOrFieldsOrOptions
 * @param maybeFieldsOrOptions
 * @param maybeOptions
 * @returns
 */
export function ColumnIndex<T>(
	nameOrFieldsOrOptions?: CombinedIndexOptions<T>,
	maybeFieldsOrOptions?: CombinedIndexOptions<T> | { synchronize: false },
	maybeOptions?: CombinedIndexOptions<T>
) {
	// normalize parameters
	const name = typeof nameOrFieldsOrOptions === 'string' ? nameOrFieldsOrOptions : undefined;

	const fields =
		typeof nameOrFieldsOrOptions === 'string'
			? <string[]>maybeFieldsOrOptions
			: (nameOrFieldsOrOptions as string[]);

	let options = isPlainObject(nameOrFieldsOrOptions) ? nameOrFieldsOrOptions : maybeOptions;

	if (!options) {
		options = isPlainObject(maybeFieldsOrOptions) ? (maybeFieldsOrOptions as TypeOrmIndexOptions) : maybeOptions;
	}

	/**
	 * Decorator for applying indexes in both TypeORM and MikroORM.
	 * It can be used to decorate fields in an entity class.
	 *
	 * @param target The prototype of the class (in case of class decorator) or the constructor of the class (in case of property decorator).
	 * @param propertyKey The name of the property to which the decorator is applied. This is undefined for class decorators.
	 */
	return (target: any, propertyKey?: any) => {
		// Apply TypeORM index. If 'name' and 'fields' are specified it creates a named index on the specified properties.
		// Otherwise, it uses 'options' to determine the indexing strategy.
		applyTypeOrmIndex(target, propertyKey, name, fields, options as TypeOrmIndexOptions);

		// Apply MikroORM index. It behaves similarly to the TypeORM index application, but with specifics to MikroORM.
		applyMikroOrmIndex(target, propertyKey as never, name, fields, options as TypeOrmIndexOptions);
	};
}

/**
 * Applies a TypeORM index to the specified target.
 *
 * @param target The class or class property to which the index will be applied.
 * @param propertyKey The name of the property, if applying to a specific property.
 * @param name Optional name of the index for named indexes.
 * @param properties Optional list of properties to be indexed.
 * @param options Optional TypeORM indexing options.
 */
export function applyTypeOrmIndex(
	target: any,
	propertyKey: string | undefined,
	name: string | undefined,
	fields: string[] | undefined,
	options: TypeOrmIndexOptions = {}
) {
	if (name && fields) {
		// Applies a named index on specified properties with additional options
		TypeOrmIndex(name, fields, options)(target, propertyKey);
	} else if (name) {
		// Applies a named index with additional options (without specifying properties)
		TypeOrmIndex(name, options)(target, propertyKey);
	} else if (fields) {
		// Applies an index on specified properties without a name or additional options
		TypeOrmIndex(fields)(target, propertyKey);
	} else if (options) {
		// Applies an index with only options, without specifying a name or properties
		TypeOrmIndex(options)(target, propertyKey);
	} else {
		// Applies a default index when no name, properties, or options are specified
		TypeOrmIndex()(target, propertyKey);
	}
}

/**
 * Applies a MikroORM index to the specified target. If 'unique' option is set,
 * also applies a unique constraint. This function adapts TypeORM index options
 * to MikroORM.
 *
 * @param target The class or class property to which the index will be applied.
 * @param propertyKey The name of the property, if applying to a specific property.
 * @param name Optional name of the index for named indexes.
 * @param properties Optional list of properties to be indexed.
 * @param options Optional TypeORM indexing options that will be adapted for MikroORM.
 */
export function applyMikroOrmIndex(
	target: any,
	propertyKey: string | symbol | undefined,
	name: string | undefined,
	properties: any,
	options: TypeOrmIndexOptions | undefined
) {
	// Converts provided indexing parameters into MikroORM-compatible index options.
	const mikroOptions = parseToMikroOrmIndexOptions<Object>({ name, properties });

	if (mikroOptions.name && mikroOptions.properties && Array.isArray(properties)) {
		// Applies a named index on specified properties
		MikroOrmIndex(mikroOptions)(target, propertyKey);
	} else if (mikroOptions.name) {
		// Applies a named index without specific properties
		MikroOrmIndex({ name: mikroOptions.name })(target, propertyKey);
	} else {
		// Applies a default index without specific options or fields
		MikroOrmIndex()(target, propertyKey);
	}

	// Apply a MikroORM unique constraint if 'unique' is specified in the options
	if (options?.unique && Array.isArray(properties)) {
		MikroUnique({ properties })(target, propertyKey);
	}
}

/**
 * Transforms index options from TypeORM format to MikroORM format.
 * This function should be implemented based on the specific requirements and
 * differences between TypeORM and MikroORM index options.
 *
 * @param options The TypeORM index options to be transformed.
 * @returns The transformed MikroORM index options.
 */
export function parseToMikroOrmIndexOptions<T>(options: MikroOrmIndexOptions<T>): MikroOrmIndexOptions<T> {
	// Logic to transform options to MikroORM compatible format
	// This is a placeholder, actual implementation depends on how the options differ.
	return options;
}
