import { ColumnType as MikroORMColumnType, PropertyOptions as MikroORMPropertyOptions } from '@mikro-orm/core';
import { ColumnType as TypeORMColumnType, ColumnOptions as TypeORMColumnOptions } from 'typeorm';

//
type CommonColumnOptions<T> = Omit<MikroORMColumnOptions<T>, 'type' | 'default'> & Omit<TypeORMColumnOptions, 'type'> & {
    type?: ColumnDataType;
    relationId?: boolean; // Need to prevent Mikro-orm property decorator when relationId column
};

// Represents MikroORM-specific column options, using MikroORM's PropertyOptions.
export type MikroORMColumnOptions<T> = MikroORMPropertyOptions<T>;

// Represents the type of data that can be used for a column in either TypeORM or MikroORM.
export type ColumnDataType = TypeORMColumnType | MikroORMColumnType;

// Represents common column options that can be used in both TypeORM and MikroORM.
export type ColumnOptions<T> = CommonColumnOptions<T>;
