import { Cascade, EntityName, ManyToOneOptions, ManyToOne as MikroOrmManyToOne } from "@mikro-orm/core";
import { ObjectType, RelationOptions as TypeOrmRelationOptions, ManyToOne as TypeOrmManyToOne } from 'typeorm';
import { omit } from "underscore";
import { deepClone } from "@gauzy/common";
import { ObjectUtils } from "../../../../core/util/object-utils";

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
    options?: RelationOptions<T>;
    // The property key of the target entity.
    propertyKey?: string;
    // The target string (optional).
    target?: string;
}

type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type TypeORMInverseSide<T> = string | ((object: T) => any);
type TypeORMRelationOptions = Omit<TypeOrmRelationOptions, 'cascade'>;

type MikroORMTarget<T, O> = ManyToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);
type MikroORMRelationOptions<T, O> = Omit<Partial<ManyToOneOptions<T, O>>, 'cascade' | 'onUpdate' | 'onDelete'>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type RelationOptions<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions & {
    cascade?: Cascade[] | (boolean | ("update" | "insert" | "remove" | "soft-remove" | "recover")[]);
};

/**
 * Decorator for creating ManyToOne relationships for both MikroORM and TypeORM.
 *
 * @template T - The type of the target entity.
 * @param typeFunctionOrTarget - The target entity class or a function returning the target entity class.
 * @param inverseSideOrOptions - The inverse side of the relationship or additional options if provided.
 * @param options - The options for the ManyToOne relationship.
 * @returns PropertyDecorator.
 */
export function MultiORMManyToOne<T>(
    typeFunctionOrTarget: TargetEntity<T>,
    inverseSideOrOptions?: InverseSide<T> | RelationOptions<T>,
    options?: RelationOptions<T>
): PropertyDecorator {
    // Normalize parameters.
    let inverseSideProperty: InverseSide<T>;

    if (ObjectUtils.isObject(inverseSideOrOptions)) {
        options = <RelationOptions<T>>inverseSideOrOptions;
    } else {
        inverseSideProperty = inverseSideOrOptions as any;
    }

    return (target: any, propertyKey: string) => {
        if (!options) options = {} as RelationOptions<T>

        TypeOrmManyToOne(typeFunctionOrTarget as TypeORMTarget<T>, inverseSideOrOptions as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
        MikroOrmManyToOne(mapManyToOneArgsForMikroORM({ typeFunctionOrTarget, inverseSideOrOptions: inverseSideProperty as InverseSide<T>, options, propertyKey, target }))(target, propertyKey);
    };
}

/**
 * Maps TypeORM ManyToOne relation options to MikroORM options for MikroORM integration with TypeORM.
 *
 * @param param0 - Destructured parameters object.
 * @returns MikroORMRelationOptions - The mapped MikroORM relation options.
 */
export function mapManyToOneArgsForMikroORM<T, O>({ typeFunctionOrTarget, options, propertyKey }: MapManyToOneArgsForMikroORMOptions<T, O>) {
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
            mikroORMCascade = typeOrmOptions.cascade.map((c) => {
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
            }).filter((c) => c) as Cascade[];
        }
    }

    // Create MikroORM relation options
    const mikroOrmOptions: Partial<ManyToOneOptions<T, any>> = {
        ...omit(options, 'onDelete', 'onUpdate') as any,
        entity: typeFunctionOrTarget as (string | ((e?: any) => EntityName<T>)),
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        deleteRule: typeOrmOptions?.onDelete?.toLocaleLowerCase(),
        updateRule: typeOrmOptions?.onUpdate?.toLocaleLowerCase(),
        lazy: !!typeOrmOptions?.lazy,
    };

    // Set default joinColumn and referenceColumnName if not provided
    if (!mikroOrmOptions.joinColumn && propertyKey) {
        // Set default joinColumn if not overwrite in options
        mikroOrmOptions.joinColumn = `${propertyKey}Id`;
        mikroOrmOptions.referenceColumnName = `id`;
    }

    // Return the mapped MikroORM relation options
    return mikroOrmOptions as MikroORMRelationOptions<any, any>
}
