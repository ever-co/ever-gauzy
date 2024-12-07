import { Cascade, EntityName, ManyToOneOptions } from '@mikro-orm/core';
import { omit } from 'underscore';
import { deepClone } from '@gauzy/common';
import { ObjectUtils } from '../../../../core/util/object-utils';
import { TypeOrmManyToOne } from './type-orm';
import { MikroOrmManyToOne } from './mikro-orm';
import {
	MikroORMInverseSide,
	TypeORMInverseSide,
	TypeORMRelationOptions,
	TypeORMTarget,
	TypeOrmCascadeOption
} from './shared-types';

/**
 * Options for mapping ManyToOne relationship arguments for MikroORM.
 *
 * @template T - The type of the target entity.
 * @template O - The type of additional options.
 */
export interface MapManyToOneArgsForMikroORMOptions<T, O> {
	// The target entity class or function returning the target entity class.
	typeFunctionOrTarget: TargetEntity<T>;
	// The inverse side of the relationship or additional options if provided.
	inverseSideOrOptions?: InverseSide<T>;
	// The options for the ManyToOne relationship.
	options?: RelationOptions<T, O>;
	// The property key of the target entity.
	propertyKey?: string;
	// The target string (optional).
	target?: string;
}

type MikroORMTarget<T, O> = ManyToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);
type MikroORMRelationOptions<T, O> = Omit<Partial<ManyToOneOptions<T, O>>, 'cascade' | 'onUpdate' | 'onDelete'>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
export type RelationOptions<T, O> = MikroORMRelationOptions<T, O> &
	TypeORMRelationOptions & {
		cascade?: Cascade[] | TypeOrmCascadeOption;
	};

/**
 * Decorator for defining Many-to-One relationships in both TypeORM and MikroORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSideOrOptions - Inverse side of the relationship or additional options.
 * @param options - Additional options for the Many-to-One relationship.
 * @returns PropertyDecorator
 */
export function MultiORMManyToOne<T, O>(
	typeFunctionOrTarget: TargetEntity<T>,
	inverseSideOrOptions?: InverseSide<T> | RelationOptions<T, O>,
	options?: RelationOptions<T, O>
): PropertyDecorator {
	// Normalize parameters.
	let inverseSideProperty: InverseSide<T>;

	if (ObjectUtils.isObject(inverseSideOrOptions)) {
		options = <RelationOptions<T, O>>inverseSideOrOptions;
	} else {
		inverseSideProperty = inverseSideOrOptions as any;
	}

	return (target: any, propertyKey: string) => {
		// If options are not provided, initialize an empty object
		if (!options) options = {} as RelationOptions<T, O>;

		// Use TypeORM decorator for Many-to-One
		TypeOrmManyToOne(
			typeFunctionOrTarget as TypeORMTarget<T>,
			inverseSideOrOptions as TypeORMInverseSide<T>,
			options as TypeORMRelationOptions
		)(target, propertyKey);

		// Use MikroORM decorator for Many-to-One
		MikroOrmManyToOne(
			mapManyToOneArgsForMikroORM({
				typeFunctionOrTarget,
				inverseSideOrOptions: inverseSideProperty as InverseSide<T>,
				options,
				propertyKey,
				target
			})
		)(target, propertyKey);
	};
}

/**
 * Maps TypeORM ManyToOne relation options to MikroORM options for MikroORM integration with TypeORM.
 *
 * @param param0 - Destructured parameters object.
 * @returns MikroORMRelationOptions - The mapped MikroORM relation options.
 */
export function mapManyToOneArgsForMikroORM<T, O>({
	typeFunctionOrTarget,
	options,
	propertyKey
}: MapManyToOneArgsForMikroORMOptions<T, O>) {
	// Cast options to RelationOptions
	const typeOrmOptions = deepClone(options) as RelationOptions<T, O>;

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
			// Define a mapping from TypeORM cascade options to MikroORM cascade options
			const cascading: { [key: string]: Cascade | null } = {
				insert: Cascade.PERSIST,
				update: Cascade.MERGE,
				remove: Cascade.REMOVE,
				'soft-remove': null,
				recover: null
			};

			mikroORMCascade = typeOrmOptions.cascade.map((c: any) => cascading[c] || null).filter(Boolean) as Cascade[];
		}
	}

	// Create MikroORM relation options
	const mikroOrmOptions: Partial<ManyToOneOptions<T, any>> = {
		...(omit(options, 'onDelete', 'onUpdate') as any),
		entity: typeFunctionOrTarget as string | ((e?: any) => EntityName<T>),
		...(mikroORMCascade.length ? { cascade: mikroORMCascade } : {}),
		...(typeOrmOptions?.onDelete ? { deleteRule: typeOrmOptions?.onDelete?.toLocaleLowerCase() } : {}),
		...(typeOrmOptions?.onUpdate ? { updateRule: typeOrmOptions?.onUpdate?.toLocaleLowerCase() } : {})
	};

	// Set default joinColumn and referenceColumnName if not provided
	if (!mikroOrmOptions.joinColumn && propertyKey) {
		// Set default joinColumn if not overwrite in options
		mikroOrmOptions.joinColumn = `${propertyKey}Id`;
		mikroOrmOptions.referenceColumnName = `id`;
	}

	// Return the mapped MikroORM relation options
	return mikroOrmOptions as MikroORMRelationOptions<any, any>;
}
