import { Cascade, EntityName, OneToManyOptions, OneToMany as MikroOrmOneToMany } from "@mikro-orm/core";
import { ObjectType, RelationOptions, OneToMany as TypeOrmOneToMany } from 'typeorm';


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = OneToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = RelationOptions;
type MikroORMRelationOptions<T, O> = Partial<OneToManyOptions<T, O>>;


type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions;


export function MultiORMOneToMany<T>(
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T> | Options<T>,
    options?: Options<T>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroOrmOneToMany(mapOneToManyArgsForMikroORM({ targetEntity, inverseSide: inverseSide as InverseSide<T>, options }))(target, propertyKey);
        TypeOrmOneToMany(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapOneToManyArgsForMikroORMOptions<T, O> {
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T>,
    options?: Options<T>
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
