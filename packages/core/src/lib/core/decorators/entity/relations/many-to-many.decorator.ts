import { Cascade, EntityName, ManyToManyOptions } from '@mikro-orm/core';
import { RelationOptions as TypeOrmRelationOptions } from 'typeorm';
import { omit } from 'underscore';
import { deepClone, isObject } from '@gauzy/utils';
import { MultiORMEnum } from '../../../../core/utils';
import { TypeOrmManyToMany } from './type-orm';
import { MikroOrmManyToMany } from './mikro-orm';
import { MikroORMInverseSide, TypeORMInverseSide, TypeORMRelationOptions, TypeORMTarget } from './shared-types';

/**
 * Interface for options used in mapping Many-to-Many relationships in MikroORM.
 *
 */
export interface MapManyToManyArgsForMikroORMOptions<T, O> {
	// Type or target function for the related entity.
	typeFunctionOrTarget: TargetEntity<T>;
	// Inverse side of the relationship.
	inverseSide?: InverseSide<T>;
	// Additional options for the Many-to-Many relationship.
	options?: RelationOptions<T>;
}

type MikroORMTarget<T, O> = ManyToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);
type MikroORMRelationOptions<T, O> = Partial<Omit<ManyToManyOptions<T, O>, 'cascade' | 'onCreate' | 'onUpdate'>>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type RelationOptions<T> = MikroORMRelationOptions<T, any> &
	TypeORMRelationOptions & {
		cascade?: Cascade[] | (boolean | ('update' | 'insert' | 'remove' | 'soft-remove' | 'recover')[]);
	};

/**
 * Decorator for defining Many-to-Many relationships in both TypeORM and MikroORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSide - Inverse side of the relationship or additional options.
 * @param options - Additional options for the Many-to-Many relationship.
 * @returns PropertyDecorator
 */
export function MultiORMManyToMany<T>(
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

	return (target: any, propertyKey: string) => {
		// If options are not provided, initialize an empty object
		if (!options) options = {} as RelationOptions<T>;

		// Use TypeORM decorator for Many-to-Many
		TypeOrmManyToMany(
			typeFunctionOrTarget as TypeORMTarget<T>,
			inverseSideProperty as TypeORMInverseSide<T>,
			options as TypeORMRelationOptions
		)(target, propertyKey);

		// Use MikroORM decorator for Many-to-Many
		MikroOrmManyToMany(
			mapManyToManyArgsForMikroORM({
				typeFunctionOrTarget,
				inverseSide: inverseSideProperty as InverseSide<T>,
				options
			})
		)(target, propertyKey);
	};
}

/**
 * Maps Many-to-Many relationship options for MikroORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSide - Inverse side of the relationship.
 * @param options - Additional options for the Many-to-Many relationship.
 * @returns MikroORM-specific Many-to-Many relationship options.
 */
function mapManyToManyArgsForMikroORM<T, O>({
	typeFunctionOrTarget,
	inverseSide,
	options
}: MapManyToManyArgsForMikroORMOptions<T, O>) {
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
	const mikroOrmOptions: Partial<RelationOptions<T>> = {
		...(omit(options, 'onDelete', 'onUpdate') as any),
		entity: typeFunctionOrTarget as string | ((e?: any) => EntityName<T>),
		cascade: mikroORMCascade,
		...(typeOrmOptions?.nullable ? { nullable: typeOrmOptions?.nullable } : {}),
		...(typeOrmOptions?.lazy ? { lazy: typeOrmOptions?.lazy } : {})
	};

	// Map inverseSideOrOptions based on the DB_ORM environment variable
	if (process.env.DB_ORM == MultiORMEnum.MikroORM) {
		if (mikroOrmOptions.owner === true) {
			mikroOrmOptions.inversedBy = inverseSide;
		} else {
			mikroOrmOptions.mappedBy = inverseSide;
		}
	}

	return mikroOrmOptions as MikroORMRelationOptions<any, any>;
}
