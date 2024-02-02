import { Cascade, EntityName, ManyToManyOptions, ManyToMany as MikroOrmManyToMany } from "@mikro-orm/core";
import { ObjectType, RelationOptions, ManyToMany as TypeOrmManyToMany } from 'typeorm';


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = ManyToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = RelationOptions;
type MikroORMRelationOptions<T, O> = Partial<Omit<ManyToManyOptions<T, O>, 'onCreate' | 'onUpdate'>>;

type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions;

export function MultiORMManyToMany<T>(
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T> | Options<T>,
    options?: Options<T>
): PropertyDecorator {

    // If second params is options then set inverseSide as null and options = inverseSide
    if (typeof inverseSide === 'object') {
        options = inverseSide;
        inverseSide = null;
    }

    return (target: any, propertyKey: string) => {
        MikroOrmManyToMany(mapManyToManyArgsForMikroORM({ targetEntity, inverseSide: inverseSide as InverseSide<T>, options }))(target, propertyKey);
        TypeOrmManyToMany(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapManyToManyArgsForMikroORMOptions<T, O> {
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T>,
    options?: Options<T>
}

export function mapManyToManyArgsForMikroORM<T, O>({ targetEntity, inverseSide, options }: MapManyToManyArgsForMikroORMOptions<T, O>) {

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

    const mikroOrmOptions: Partial<Options<T>> = {
        cascade: mikroORMCascade,
        nullable: typeOrmOptions.nullable,
        lazy: !!typeOrmOptions.lazy,
        ...options as Partial<Options<T>>
    };


    return {
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        mappedBy: inverseSide,
        ...mikroOrmOptions,
    } as MikroORMRelationOptions<any, any>
}
