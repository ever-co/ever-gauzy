import { Cascade, EntityName, OneToManyOptions, OneToMany as MikroOrmOneToMany } from "@mikro-orm/core";
import { ObjectType, RelationOptions, OneToMany as TypeOrmOneToMany } from 'typeorm';


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = OneToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = RelationOptions;
type MikroORMRelationOptions<T, O> = Partial<OneToManyOptions<T, O>>;


export function MultiORMOneToMany<T>(
    targetEntity: TypeORMTarget<T> | MikroORMTarget<T, any>,
    inverseSide: TypeORMInverseSide<T> | MikroORMInverseSide<T>,
    options?: TypeORMRelationOptions | MikroORMRelationOptions<T, any>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroOrmOneToMany(mapOneToManyArgsForMikroORM({ targetEntity, inverseSide, options }))(target, propertyKey);
        TypeOrmOneToMany(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapOneToManyArgsForMikroORMOptions<T, O> {
    targetEntity: TypeORMTarget<T> | MikroORMTarget<T, any>,
    inverseSide?: TypeORMInverseSide<T> | MikroORMInverseSide<T>,
    options?: TypeORMRelationOptions | MikroORMRelationOptions<T, any>
}

export function mapOneToManyArgsForMikroORM<T, O>({ targetEntity, inverseSide, options }: MapOneToManyArgsForMikroORMOptions<T, O>) {

    const typeOrmOptions = options as RelationOptions;
    let mikroORMCascade = [];
    if (typeOrmOptions?.cascade) {
        if (typeof typeOrmOptions.cascade === 'boolean') {
            mikroORMCascade = typeOrmOptions.cascade === true ? [Cascade.ALL] : [];
        }

        if (typeOrmOptions?.cascade instanceof Array) {
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

    const mikroOrmOptions: Partial<OneToManyOptions<T, any>> = {
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        lazy: !!typeOrmOptions?.lazy,
        ...options as Partial<OneToManyOptions<T, any>>
    };


    return {
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        mappedBy: inverseSide,
        ...mikroOrmOptions,
    } as OneToManyOptions<T, O>;
}
