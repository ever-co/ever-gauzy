import { Cascade, EntityName, OneToManyOptions } from '@mikro-orm/core';
import { RelationOptions as TypeOrmRelationOptions } from 'typeorm';
import { omit } from 'underscore';
import { deepClone } from '@gauzy/common';
import { isObject } from '@gauzy/utils';
import { TypeOrmOneToMany } from './type-orm';
import { MikroOrmOneToMany } from './mikro-orm';
import { MikroORMInverseSide, TypeORMInverseSide, TypeORMRelationOptions, TypeORMTarget } from './shared-types';

/**
 * Options for mapping One-to-Many relationship arguments for MikroORM.
 */
export interface MapOneToManyArgsForMikroORMOptions<T, O> {
	// Type or target function for the related entity
	typeFunctionOrTarget: TargetEntity<T>;
	// Inverse side of the relationship
	inverseSide?: InverseSide<T>;
	// Additional options for the One-to-Many relationship
	options?: RelationOptions<T>;
}

type MikroORMTarget<T, O> = OneToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);
type MikroORMRelationOptions<T, O> = Omit<Partial<OneToManyOptions<T, O>>, 'cascade'>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type RelationOptions<T> = MikroORMRelationOptions<T, any> &
	TypeORMRelationOptions & {
		cascade?: Cascade[] | (boolean | ('update' | 'insert' | 'remove' | 'soft-remove' | 'recover')[]);
	};

/**
 * Decorator for defining One-to-Many relationships that works with both MikroORM and TypeORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSide - Inverse side of the relationship or additional options (if options is provided first).
 * @param options - Additional options for the One-to-Many relationship.
 * @returns PropertyDecorator.
 */
export function MultiORMOneToMany<T>(
	typeFunctionOrTarget: TargetEntity<T>,
	inverseSide?: InverseSide<T> | RelationOptions<T>,
	options?: RelationOptions<T>
): PropertyDecorator {
	// Normalize parameters.
	let inverseSideProperty: InverseSide<T>;

	if (isObject(inverseSide)) {
		options = <RelationOptions<T>>inverseSide;
	} else {
		inverseSideProperty = inverseSide as any;
	}

	// The decorator function applied to the target property
	return (target: any, propertyKey: string) => {
		// If options are not provided, initialize an empty object
		if (!options) options = {} as RelationOptions<T>;

		// Apply TypeORM One-to-Many decorator
		TypeOrmOneToMany(
			typeFunctionOrTarget as TypeORMTarget<T>,
			inverseSideProperty as TypeORMInverseSide<T>,
			options as TypeORMRelationOptions
		)(target, propertyKey);

		// Apply MikroORM One-to-Many decorator
		MikroOrmOneToMany(
			mapOneToManyArgsForMikroORM({
				typeFunctionOrTarget,
				inverseSide: inverseSideProperty as InverseSide<T>,
				options
			})
		)(target, propertyKey);
	};
}

/**
 * Maps TypeORM OneToMany relation options to MikroORM options for MikroORM integration with TypeORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSide - Inverse side of the relationship.
 * @param options - Additional options for the One-to-Many relationship.
 * @returns MikroORM-specific One-to-Many relationship options.
 */
function mapOneToManyArgsForMikroORM<T, O>({
	typeFunctionOrTarget,
	inverseSide,
	options
}: MapOneToManyArgsForMikroORMOptions<T, O>) {
	// Cast options to RelationOptions
	const typeOrmOptions = deepClone(options) as TypeOrmRelationOptions;

	// Initialize an array to store MikroORM cascade options
	let mikroORMCascade: Cascade[] = [];

	// Check if TypeORM cascade options are provided
	if (typeOrmOptions?.cascade) {
		// Handle boolean cascade option
		if (typeof typeOrmOptions.cascade === 'boolean') {
			mikroORMCascade = typeOrmOptions.cascade ? [Cascade.ALL] : [];
		}

		// Handle array cascade options
		if (typeOrmOptions?.cascade instanceof Array) {
			mikroORMCascade = typeOrmOptions.cascade
				.map((c) => {
					switch (c) {
						case 'insert':
							return Cascade.PERSIST;
						case 'update':
							return Cascade.MERGE;
						case 'remove':
							return Cascade.REMOVE;
						case 'soft-remove':
						case 'recover':
							return null;
						default:
							return null;
					}
				})
				.filter((c) => c) as Cascade[];
		}
	}

	// Create MikroORM relation options
	const mikroOrmOptions: Partial<OneToManyOptions<T, any>> = {
		...(omit(options, 'onDelete', 'onUpdate') as Partial<OneToManyOptions<T, any>>),
		entity: typeFunctionOrTarget as string | ((e?: any) => EntityName<T>),
		mappedBy: inverseSide,
		cascade: mikroORMCascade,
		...(typeOrmOptions?.nullable ? { nullable: typeOrmOptions?.nullable } : {}),
		...(typeOrmOptions?.lazy ? { lazy: typeOrmOptions?.lazy } : {})
	};

	return mikroOrmOptions as OneToManyOptions<T, any>;
}
