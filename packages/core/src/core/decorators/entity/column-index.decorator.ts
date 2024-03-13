import { Index as TypeOrmIndex, IndexOptions as TypeOrmIndexOptions } from 'typeorm';
import { Index as MikroOrmIndex, IndexOptions as MikroOrmIndexOptions } from '@mikro-orm/core';

// Type definition for the TypeORM target.
type TypeORMIndexOptions = string | string[] | ((object: any) => any[] | { [key: string]: number }) | TypeOrmIndexOptions;
type IndexOptions<T> = TypeORMIndexOptions | MikroOrmIndexOptions<T>;

/**
 *
 * @param nameOrFieldsOrOptions
 * @returns
 */
export function ColumnIndex<T>(
    nameOrFieldsOrOptions?: IndexOptions<T>
) {
    return (target: any, propertyKey: string) => {
        TypeOrmIndex(nameOrFieldsOrOptions as TypeOrmIndexOptions)(target, propertyKey);
        MikroOrmIndex(nameOrFieldsOrOptions as MikroOrmIndexOptions<T>)
    };
}
