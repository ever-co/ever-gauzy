import { Cascade, EntityName, OneToOneOptions, OneToOne as MikroOrmOneToOne } from "@mikro-orm/core";
import { ObjectType, RelationOptions, OneToOne as TypeOrmOneToOne } from 'typeorm';
import { omit } from "underscore";


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = OneToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);


type TypeORMRelationOptions = Omit<RelationOptions, 'cascade'>;
type MikroORMRelationOptions<T, O> = Omit<Partial<OneToOneOptions<T, O>>, 'cascade'>;


type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions & {
    cascade?: Cascade[] | (boolean | ("update" | "insert" | "remove" | "soft-remove" | "recover")[]);
};

export function MultiORMOneToOne<T>(
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T> | Options<T>,
    options?: Options<T>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroOrmOneToOne(mapOneToOneArgsForMikroORM({ targetEntity, inverseSide: inverseSide as InverseSide<T>, options }))(target, propertyKey);
        TypeOrmOneToOne(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapOneToOneArgsForMikroORMOptions<T, O> {
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T>,
    options?: Options<T>
}

export function mapOneToOneArgsForMikroORM<T, O>({ targetEntity, inverseSide, options }: MapOneToOneArgsForMikroORMOptions<T, O>) {

    const typeOrmOptions = options as RelationOptions;
    let mikroORMCascade = [];
    if (typeOrmOptions?.cascade) {
        if (typeof typeOrmOptions?.cascade === 'boolean') {
            mikroORMCascade = typeOrmOptions?.cascade === true ? [Cascade.ALL] : [];
        }

        if (typeOrmOptions?.cascade instanceof Array) {
            mikroORMCascade = typeOrmOptions?.cascade.map(c => {
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

    const mikroOrmOptions: Partial<OneToOneOptions<T, any>> = {
        ...omit(options, 'onDelete', 'onUpdate') as Partial<OneToOneOptions<T, any>>,
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        deleteRule: typeOrmOptions?.onDelete?.toLocaleLowerCase(),
        updateRule: typeOrmOptions?.onUpdate?.toLocaleLowerCase(),
        lazy: !!typeOrmOptions?.lazy,
    };

    return {
        ...mikroOrmOptions,
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        // inversedBy: inverseSide,
    } as MikroORMRelationOptions<any, any>
}
