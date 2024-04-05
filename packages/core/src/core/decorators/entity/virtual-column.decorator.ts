import { Property as MikroORMColumn, PropertyOptions as MikroORMPropertyOptions } from '@mikro-orm/core';

/**
 * Custom decorator to define a non-persistent (virtual) column in a MikroORM entity.
 *
 * @param options Additional options for the property. Defaults to { persist: false }.
 * @returns A property decorator function.
 */
export function VirtualMultiOrmColumn<T extends object>(
    options: MikroORMPropertyOptions<T> = {
        persist: false
    }
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        MikroORMColumn(options)(target, propertyKey);
    };
}
