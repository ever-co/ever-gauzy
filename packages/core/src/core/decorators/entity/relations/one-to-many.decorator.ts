import { Cascade, EntityName, OneToManyOptions, OneToMany as MikroOrmOneToMany } from "@mikro-orm/core";
import { ObjectType, RelationOptions, OneToMany as TypeOrmOneToMany } from 'typeorm';
import { omit } from "underscore";


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = OneToManyOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = Omit<RelationOptions, 'cascade'>;
type MikroORMRelationOptions<T, O> = Omit<Partial<OneToManyOptions<T, O>>, 'cascade'>;



type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions & {
    cascade?: Cascade[] | (boolean | ("update" | "insert" | "remove" | "soft-remove" | "recover")[]);
};

export function MultiORMOneToMany<T>(
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
        ...omit(options, 'onDelete', 'onUpdate') as Partial<OneToManyOptions<T, any>>,
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        mappedBy: inverseSide,
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        lazy: !!typeOrmOptions?.lazy,
    };


    return mikroOrmOptions as OneToManyOptions<T, any>;
}
