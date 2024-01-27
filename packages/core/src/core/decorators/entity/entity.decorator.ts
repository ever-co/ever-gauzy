import { Entity as MikroOrmEntity, EntityOptions as MikroEntityOptions } from "@mikro-orm/core";
import { Entity as TypeOrmEntity, EntityOptions } from 'typeorm';
import { isObject } from "@gauzy/common";

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param options Options for the entity.
 */
export function MultiORMEntity(options?: EntityOptions | MikroEntityOptions<any>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param name Name of the entity table.
 * @param options Options for the entity.
 */
export function MultiORMEntity(name?: string, options?: EntityOptions | MikroEntityOptions<any>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param nameOrOptions Name of the entity table or options for the entity.
 * @param maybeOptions Options for the entity (if nameOrOptions is a string).
 * @returns Class decorator.
 */
export function MultiORMEntity(
    nameOrOptions?: string | EntityOptions | MikroEntityOptions<any>,
    maybeOptions?: EntityOptions
): ClassDecorator {
    // Extract MikroORM options based on the type of nameOrOptions
    const mikroOrmOptions: any = isObject(nameOrOptions) ? nameOrOptions : typeof nameOrOptions === "string" ? { tableName: nameOrOptions } : {};

    // Extract TypeORM options based on the type of nameOrOptions
    const typeOrmOptions: any = isObject(nameOrOptions) ? (nameOrOptions as EntityOptions) : nameOrOptions || {};

    /**
     * Class decorator for creating entities with both MikroORM and TypeORM decorators.
     * @param target The target class.
     */
    return (target: any) => {
        // Apply MikroORM entity decorator to the target class prototype
        MikroOrmEntity(mikroOrmOptions)(target);

        // Apply TypeORM entity decorator to the target class
        TypeOrmEntity(typeOrmOptions, maybeOptions)(target);
    };
}
