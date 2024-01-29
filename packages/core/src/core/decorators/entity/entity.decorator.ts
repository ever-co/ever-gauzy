import { Entity as MikroOrmEntity } from "@mikro-orm/core";
import { Entity as TypeOrmEntity, EntityOptions } from 'typeorm';
import { isObject } from "@gauzy/common";
import { MikroOrmEntityOptions } from "./mikro.types";
import { parseMikroEntityOptions } from './mikro.helper';

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param options Options for the entity.
 */
export function MultiORMEntity<T>(options?: EntityOptions | MikroOrmEntityOptions<T>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param name Name of the entity table.
 * @param options Options for the entity.
 */
export function MultiORMEntity<T>(name?: string, options?: EntityOptions | MikroOrmEntityOptions<T>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param nameOrOptions Name of the entity table or options for the entity.
 * @param maybeOptions Options for the entity (if nameOrOptions is a string).
 * @returns Class decorator.
 */
/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param nameOrOptions Name of the entity table or options for the entity.
 * @param maybeOptions Options for the entity (if nameOrOptions is a string).
 * @returns Class decorator.
 */
export function MultiORMEntity<T>(
    nameOrOptions?: string | EntityOptions | MikroOrmEntityOptions<T>,
    maybeOptions?: EntityOptions
): ClassDecorator {
    // Extract MikroORM options based on the type of nameOrOptions
    const mikroOrmOptions: any = isObject(nameOrOptions) ? nameOrOptions : typeof nameOrOptions === "string" ? { tableName: nameOrOptions, ...maybeOptions } : {};

    // Extract TypeORM options based on the type of nameOrOptions
    const typeOrmOptions: any = isObject(nameOrOptions) ? (nameOrOptions as EntityOptions) : nameOrOptions || {};

    /**
     * Class decorator for creating entities with both MikroORM and TypeORM decorators.
     * @param target The target class.
     */
    return (target: any) => {
        console.log(parseMikroEntityOptions(mikroOrmOptions));

        // Apply MikroORM entity decorator to the target class prototype
        MikroOrmEntity(parseMikroEntityOptions(mikroOrmOptions))(target);

        // Apply TypeORM entity decorator to the target class
        TypeOrmEntity(typeOrmOptions, maybeOptions)(target);
    };
}
