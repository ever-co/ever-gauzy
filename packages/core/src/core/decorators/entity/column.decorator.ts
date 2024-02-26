import { ColumnType as MikroORMColumnType, PropertyOptions as MikroORMColumnOptions, Property as MikroORMColumn } from '@mikro-orm/core';
import { ObjectUtils } from '../../../core/util/object-utils';
import { ColumnType as TypeORMColumnType, ColumnOptions as TypeORMColumnOptions, Column as TypeORMColumn } from 'typeorm';

type ColumnDataType = TypeORMColumnType | MikroORMColumnType;
type ColumnOptions<T> = Omit<MikroORMColumnOptions<T>, 'type' | 'default'> & Omit<TypeORMColumnOptions, 'type'> & {
    type?: ColumnDataType;
    relationId?: boolean // Need to prevent Mikro-orm property decorator when relationId column
};

/**
 * Resolve the database column type.
 * @param columnType - The input column type.
 * @returns The resolved column type.
 */
export function resolveDbType(columnType: ColumnDataType): ColumnDataType {
    return columnType;
}

/**
 * Decorator for creating column definitions for both MikroORM and TypeORM.
 *
 * @template T - The type of the column.
 * @param typeOrOptions - The column type or additional options if provided.
 * @param options - The options for the column.
 * @returns PropertyDecorator.
 */
export function MultiORMColumn<T>(
    typeOrOptions?: ColumnDataType | ColumnOptions<T>,
    options?: ColumnOptions<T>
): PropertyDecorator {
    // normalize parameters
    let type: ColumnDataType | undefined;

    if (typeof typeOrOptions === 'string' || typeof typeOrOptions === 'function') {
        // If typeOrOptions is a string or function, set 'type' to the resolved type and 'options' to an empty object.
        type = resolveDbType(typeOrOptions);
    } else if (ObjectUtils.isObject(typeOrOptions)) {
        // If typeOrOptions is an object, assume it is 'options' and set 'type' accordingly.
        options = <ColumnOptions<T>>typeOrOptions;
        type = resolveDbType(options.type);
    }

    // Ensure 'options' is initialized to an empty object if it is null or undefined.
    if (!options) options = {} as ColumnOptions<T>;

    return (target: any, propertyKey: string) => {
        TypeORMColumn({ type: type as ColumnDataType, ...options })(target, propertyKey);
        MikroORMColumn(mapColumnArgsForMikroORM({ type: type as ColumnDataType, options }))(target, propertyKey);
    };
}

/**
 * Options for mapping column arguments in MikroORM.
 * @template T - The type of the column.
 */
interface MapColumnArgsForMikroORMOptions<T, O> {
    /** The data type of the column. */
    type: ColumnDataType;

    /** Additional options for the column. */
    options?: ColumnOptions<T>;
}

/**
 * Map column arguments for MikroORM.
 * @param param0 - The options for mapping column arguments.
 * @returns MikroORM column options.
 */
export function mapColumnArgsForMikroORM<T>({ type, options }): MikroORMColumnOptions<T> {
    if (typeof options?.default === 'function') {
        options.default = options.default();
    }
    if (options?.relationId) {
        options.persist = false;
    }
    return {
        type: type,
        ...options
    }
}
