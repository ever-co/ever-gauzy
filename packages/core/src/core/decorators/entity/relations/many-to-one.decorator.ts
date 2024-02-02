import { Cascade, EntityName, ManyToOneOptions, ManyToOne as MikroOrmManyToOne } from "@mikro-orm/core";
import { ObjectType, RelationOptions, ManyToOne as TypeOrmManyToOne } from 'typeorm';


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = ManyToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = RelationOptions;
type MikroORMRelationOptions<T, O> = Partial<ManyToOneOptions<T, O>>;


export function MultiORMManyToOne<T>(
    targetEntity: TypeORMTarget<T> | MikroORMTarget<T, any>,
    inverseSide?: TypeORMInverseSide<T> | MikroORMInverseSide<T>,
    options?: TypeORMRelationOptions | MikroORMRelationOptions<T, any>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroOrmManyToOne(mapManyToOneArgsForMikroORM({ targetEntity, inverseSide, options }))(target, propertyKey);
        TypeOrmManyToOne(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapManyToOneArgsForMikroORMOptions<T, O> {
    targetEntity: TypeORMTarget<T> | MikroORMTarget<T, any>,
    inverseSide?: TypeORMInverseSide<T> | MikroORMInverseSide<T>,
    options?: TypeORMRelationOptions | MikroORMRelationOptions<T, any>
}

export function mapManyToOneArgsForMikroORM<T, O>({ targetEntity, inverseSide, options }: MapManyToOneArgsForMikroORMOptions<T, O>) {

    const typeOrmOptions = options as RelationOptions;
    let mikroORMCascade = [];
    if (typeOrmOptions.cascade) {
        if (typeof typeOrmOptions.cascade === 'boolean') {
            mikroORMCascade = typeOrmOptions.cascade === true ? [Cascade.ALL] : [];
        }

        if (typeOrmOptions.cascade instanceof Array) {
            mikroORMCascade = typeOrmOptions.cascade.map(c => {
                switch (c) {
                    case "insert":
                        return Cascade.PERSIST;
                    case "update":
                        return Cascade.MERGE;
                    case "remove":
                        return Cascade.REMOVE;
                    case "soft-remove":
                        return null;
                    case "recover":
                        return null;
                }
            }).filter((c) => c);
        }
    }

    const mikroOrmOptions: Partial<ManyToOneOptions<T, any>> = {
        cascade: mikroORMCascade,
        nullable: typeOrmOptions.nullable,
        deleteRule: typeOrmOptions.onDelete?.toLocaleLowerCase(),
        updateRule: typeOrmOptions.onUpdate?.toLocaleLowerCase(),
        lazy: !!typeOrmOptions.lazy,
        ...options as Partial<ManyToOneOptions<T, any>>
    };


    return {
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        inversedBy: inverseSide,
        ...mikroOrmOptions,
    } as MikroORMRelationOptions<any, any>
}
