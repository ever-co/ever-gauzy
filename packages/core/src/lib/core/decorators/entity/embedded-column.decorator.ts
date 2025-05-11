import { Column } from 'typeorm';
import { ColumnEmbeddedOptions as TypeOrmEmbeddedOptions } from 'typeorm/decorator/options/ColumnEmbeddedOptions';
import { Embedded, EmbeddedOptions as MikroOrmEmbeddedOptions } from '@mikro-orm/core';
import { Type } from '@gauzy/common';
import { filterOptions } from './entity.helper';

/**
 * ColumnEmbeddedOptions combines options from TypeORM and MikroORM embedded columns.
 * It merges all properties from TypeOrmEmbeddedOptions and MikroOrmEmbeddedOptions.
 */
export type ColumnEmbeddedOptions<Owner = any, Target = any> = TypeOrmEmbeddedOptions &
	MikroOrmEmbeddedOptions<Owner, Target>;

/**
 * Options for embedding columns in entities.
 */
export type EntityColumnEmbeddedOptions = {
	/**
	 * Function returning the Type of the MikroORM embeddable entity.
	 * Allows dynamic referencing of the embedded class in MikroORM.
	 */
	mikroOrmEmbeddableEntity?: () => Type;
	/**
	 * Function returning the Type of the TypeORM embeddable entity.
	 * Used to reference the embedded class in TypeORM.
	 */
	typeOrmEmbeddableEntity?: () => Type;
};

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param options Options for the entity.
 */
export function EmbeddedColumn<Owner = any, Target = any>(
	typeOrTarget?: EntityColumnEmbeddedOptions,
	options?: ColumnEmbeddedOptions<Owner, Target>
): PropertyDecorator;

/**
 * A decorator factory for mapping an embeddable column in Mikro ORM.
 * @param typeFunctionOrTarget The type, function, or target entity for the MikroORM & TypeORM Embedded column.
 * @param options Additional options for the MikroORM & TypeORM column.
 * @returns A property decorator.
 */
export function EmbeddedColumn<Owner = any, Target = any>(
	typeOrTarget?: EntityColumnEmbeddedOptions,
	options?: ColumnEmbeddedOptions<Owner, Target>
): PropertyDecorator {
	// If options are not provided, initialize an empty object
	if (!options) options = { prefix: false } as ColumnEmbeddedOptions<Owner, Target>;

	// Return a property decorator function
	return (target: any, propertyKey: string) => {
		// Apply the @Embedded decorator with mapped Mikro ORM options
		const mikroOrmOptions = parseMikroOrmEmbeddableColumnOptions(typeOrTarget, options);
		Embedded(mikroOrmOptions)(target, propertyKey);

		// Apply the @Column decorator with mapped Type ORM options
		const typeOrmOptions = parseTypeOrmEmbeddableColumnOptions(options);
		Column(typeOrTarget.typeOrmEmbeddableEntity, typeOrmOptions)(target, propertyKey);
	};
}

/**
 * Parses and processes MikroORM embeddable column options.
 *
 * @param param0 Contains the `mikroOrmEmbeddableEntity` property.
 * @param restOptions Additional MikroOrmEmbeddedOptions to be filtered and processed.
 * @returns A new object with only key-value pairs where the value is defined.
 */
export const parseMikroOrmEmbeddableColumnOptions = <Owner = any, Target = any>(
	{ mikroOrmEmbeddableEntity }: EntityColumnEmbeddedOptions,
	restOptions: MikroOrmEmbeddedOptions<Owner, Target>
): Record<string, any> => {
	// Create a new object with entity and other options, filtering out undefined values
	const filteredOptions = filterOptions({
		entity: mikroOrmEmbeddableEntity,
		...restOptions
	});

	// Return the new object with only defined properties
	return filteredOptions;
};

/**
 * Parses and processes TypeORM embeddable column options.
 *
 * @param restOptions The TypeORM embedded column options to be filtered and processed.
 * @returns A new object with only key-value pairs where the value is defined.
 */
export const parseTypeOrmEmbeddableColumnOptions = (restOptions: TypeOrmEmbeddedOptions): Record<string, any> => {
	// Filter out undefined options from the given object
	const filteredOptions = filterOptions({
		...restOptions
	});

	// Return the filtered object with only defined properties
	return filteredOptions;
};
