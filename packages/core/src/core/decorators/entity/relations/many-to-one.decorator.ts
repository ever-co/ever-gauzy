import { Cascade, EntityName, ManyToOneOptions, ManyToOne as MikroOrmManyToOne } from "@mikro-orm/core";
import { ObjectType, RelationOptions, ManyToOne as TypeOrmManyToOne } from 'typeorm';


type TypeORMTarget<T> = string | ((type?: any) => ObjectType<T>);
type MikroORMTarget<T, O> = ManyToOneOptions<T, O> | string | ((e?: any) => EntityName<T>);


type TypeORMInverseSide<T> = string | ((object: T) => any);
type MikroORMInverseSide<T> = (string & keyof T) | ((object: T) => any);

type TypeORMRelationOptions = Omit<RelationOptions, 'cascade'>;
type MikroORMRelationOptions<T, O> = Omit<Partial<ManyToOneOptions<T, O>>, 'cascade' | 'onUpdate' | 'onDelete'>;



type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions & {
    cascade?: Cascade[] | (boolean | ("update" | "insert" | "remove" | "soft-remove" | "recover")[]);
};



type TargetEntity<T> = TypeORMTarget<T> | MikroORMTarget<T, any>;
type InverseSide<T> = TypeORMInverseSide<T> & MikroORMInverseSide<T>;
type Options<T> = MikroORMRelationOptions<T, any> & TypeORMRelationOptions;


export function MultiORMManyToOne<T>(
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T> | Options<T>,
    options?: Options<T>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroOrmManyToOne(mapManyToOneArgsForMikroORM({ targetEntity, inverseSide: inverseSide as InverseSide<T>, options }))(target, propertyKey);
        TypeOrmManyToOne(targetEntity as TypeORMTarget<T>, inverseSide as TypeORMInverseSide<T>, options as TypeORMRelationOptions)(target, propertyKey);
    };
}

export interface MapManyToOneArgsForMikroORMOptions<T, O> {
    targetEntity: TargetEntity<T>,
    inverseSide?: InverseSide<T>,
    options?: Options<T>
}

export function mapManyToOneArgsForMikroORM<T, O>({ targetEntity, inverseSide, options }: MapManyToOneArgsForMikroORMOptions<T, O>) {

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

    const mikroOrmOptions: Partial<ManyToOneOptions<T, any>> = {
        cascade: mikroORMCascade,
        nullable: typeOrmOptions?.nullable,
        deleteRule: typeOrmOptions?.onDelete?.toLocaleLowerCase(),
        updateRule: typeOrmOptions?.onUpdate?.toLocaleLowerCase(),
        lazy: !!typeOrmOptions?.lazy,
        ...options as any
    };


    return {
        entity: targetEntity as (string | ((e?: any) => EntityName<T>)),
        inversedBy: inverseSide,
        ...mikroOrmOptions,
    } as MikroORMRelationOptions<any, any>
}
