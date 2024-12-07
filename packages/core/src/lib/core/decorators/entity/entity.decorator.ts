import { Entity as MikroOrmEntity } from "@mikro-orm/core";
import { Entity as TypeOrmEntity } from 'typeorm';
import { isObject } from "@gauzy/common";
import { MikroOrmEntityOptions, TypeOrmEntityOptions } from "./entity-options.types";
import { parseMikroOrmEntityOptions } from './entity.helper';

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param options Options for the entity.
 */
export function MultiORMEntity<T>(options?: TypeOrmEntityOptions | MikroOrmEntityOptions<T>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param name Name of the entity table.
 * @param options Options for the entity.
 */
export function MultiORMEntity<T>(name?: string, options?: TypeOrmEntityOptions | MikroOrmEntityOptions<T>): ClassDecorator;

/**
 * Decorator for creating entities with both MikroORM and TypeORM decorators.
 * @param nameOrOptions Name of the entity table or options for the entity.
 * @param maybeOptions Options for the entity (if nameOrOptions is a string).
 * @returns Class decorator.
 */
export function MultiORMEntity<T>(
    nameOrOptions?: string | TypeOrmEntityOptions | MikroOrmEntityOptions<T>,
    maybeOptions?: TypeOrmEntityOptions
): ClassDecorator {
    // Extract MikroORM options based on the type of nameOrOptions
    const mikroOrmOptions: any = isObject(nameOrOptions) ? nameOrOptions : typeof nameOrOptions === "string" ? { tableName: nameOrOptions, ...maybeOptions } : {};

    // Extract TypeORM options based on the type of nameOrOptions
    const typeOrmOptions: any = isObject(nameOrOptions) ? (nameOrOptions as TypeOrmEntityOptions) : nameOrOptions || {};

    /**
     * Class decorator for creating entities with both MikroORM and TypeORM decorators.
     * @param target The target class.
     */
    return (target: any) => {
        // Apply MikroORM entity decorator to the target class prototype
        MikroOrmEntity(parseMikroOrmEntityOptions(mikroOrmOptions))(target);

        // Apply TypeORM entity decorator to the target class
        TypeOrmEntity(typeOrmOptions, maybeOptions)(target);
    };
}
