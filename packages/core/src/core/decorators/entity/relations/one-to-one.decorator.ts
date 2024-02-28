import { deepClone } from "@gauzy/common";
import { Cascade, EntityName, OneToOneOptions } from "@mikro-orm/core";
import { RelationOptions as TypeOrmRelationOptions } from 'typeorm';
import { omit } from "underscore";
import { MultiORMEnum } from "../../../../core/utils";
import { ObjectUtils } from "../../../../core/util/object-utils";
import { MikroORMInverseSide, TypeORMInverseSide, TypeORMRelationOptions, TypeORMTarget } from "./shared-types";
import { TypeOrmOneToOne } from "./type-orm";
import { MikroOrmOneToOne } from "./mikro-orm";

/**
 * Options for mapping OneToOne relationship arguments for MikroORM.
 *
 * @template T - The type of the target entity.
 * @template O - The type of additional options.
 */
export interface MapOneToOneArgsForMikroORMOptions<T, O> {
    // The target entity class or function returning the target entity class.
    typeFunctionOrTarget: TargetEntity<T>;
    // The inverse side of the relationship or additional options if provided.
    inverseSideOrOptions?: InverseSide<T>;
    // The options for the OneToOne relationship.
    options?: RelationOptions<T>;
    // The property key of the target entity.
    propertyKey?: string;
    // The target string (optional).
    target?: string;
}

type MikroORMTarget<T, O> = OneToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);
type MikroORMRelationOptions<T, O> = Omit<Partial<OneToOneOptions<T, O>>, 'cascade'>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type RelationOptions<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions & {
    cascade?: Cascade[] | (boolean | ("update" | "insert" | "remove" | "soft-remove" | "recover")[]);
};

/**
 * Decorator for defining One-to-One relationships in both TypeORM and MikroORM.
 *
 * @param typeFunctionOrTarget - Type or target function for the related entity.
 * @param inverseSideOrOptions - Inverse side of the relationship or additional options.
 * @param options - Additional options for the One-to-One relationship.
 * @returns PropertyDecorator
 */
export function MultiORMOneToOne<T>(
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
        // Use TypeORM decorator for One-to-One
        TypeOrmOneToOne(typeFunctionOrTarget as TypeORMTarget<T>, inverseSideOrOptions as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);

        // Use MikroORM decorator for One-to-One
        MikroOrmOneToOne(mapOneToOneArgsForMikroORM({ typeFunctionOrTarget, inverseSideOrOptions: inverseSideProperty as InverseSide<T>, options, propertyKey }))(target, propertyKey);
    };
}

/**
 * Maps TypeORM OneToOne relation options to MikroORM options for MikroORM integration with TypeORM.
 *
 * @param param0 - Destructured parameters object.
 * @returns MikroORMRelationOptions - The mapped MikroORM relation options.
 */
export function mapOneToOneArgsForMikroORM<T, O>({ typeFunctionOrTarget, inverseSideOrOptions, options, propertyKey }: MapOneToOneArgsForMikroORMOptions<T, O>) {
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
    const mikroOrmOptions: Partial<OneToOneOptions<T, any>> = {
        ...omit(options, 'onDelete', 'onUpdate') as Partial<OneToOneOptions<T, any>>,
        entity: typeFunctionOrTarget as (string | ((e?: any) => EntityName<T>)),
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        deleteRule: typeOrmOptions?.onDelete?.toLocaleLowerCase(),
        updateRule: typeOrmOptions?.onUpdate?.toLocaleLowerCase(),
        lazy: !!typeOrmOptions?.lazy,
    };

    // Set default joinColumn if not overwritten in options
    if (mikroOrmOptions.owner === true && !mikroOrmOptions.joinColumn && propertyKey) {
        mikroOrmOptions.joinColumn = `${propertyKey}Id`;
        mikroOrmOptions.referenceColumnName = `id`;
    }

    // Map inverseSideOrOptions based on the DB_ORM environment variable
    if (process.env.DB_ORM == MultiORMEnum.MikroORM) {
        if (mikroOrmOptions.owner === true) {
            mikroOrmOptions.inversedBy = inverseSideOrOptions;
        } else {
            mikroOrmOptions.mappedBy = inverseSideOrOptions;
        }
    }

    return mikroOrmOptions as MikroORMRelationOptions<any, any>;
}
