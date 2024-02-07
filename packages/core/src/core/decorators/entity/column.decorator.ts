import { ColumnType as MikroORMColumnType, PropertyOptions as MikroORMColumnOptions, Property as MikroORMColumn } from "@mikro-orm/core";
import { ColumnType as TypeORMColumnType, ColumnOptions as TypeORMColumnOptions, Column as TypeORMColumn } from 'typeorm';

type DataType = TypeORMColumnType | MikroORMColumnType;

type Options<T> = Omit<MikroORMColumnOptions<T>, 'type'> & Omit<TypeORMColumnOptions, 'type'> & {
    type: DataType;
};

export function MultiORMColumn<T>(
    type?: DataType,
    options?: Options<T>
): PropertyDecorator {

    // If second params is options then set inverseSide as null and options = inverseSide
    if (typeof type === 'object') {
        options = type;
        type = options.type;
    }

    return (target: any, propertyKey: string) => {
        MikroORMColumn(mapColumnArgsForMikroORM({ type: type, options }))(target, propertyKey);
        TypeORMColumn({ type: type, ...options })(target, propertyKey);
    };
}

export interface MapColumnArgsForMikroORMOptions<T, O> {
    type: DataType,
    options?: Options<T>
}

export function mapColumnArgsForMikroORM<T, O>({ type, options }) {
    return {
        type,
        ...options
    } as MikroORMColumnOptions<T>
}
