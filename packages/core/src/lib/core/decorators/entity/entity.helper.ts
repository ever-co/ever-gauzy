import { MikroOrmEntityOptions, TypeOrmEntityOptions } from "./entity-options.types";

/**
 * Parse MikroORM entity options, renaming 'mikroOrmRepository' to 'repository'.
 *
 * @param {MikroOrmEntityOptions<any>} options - MikroORM entity options.
 * @returns {Record<string, any>} - Parsed options.
 */
export const parseMikroOrmEntityOptions = ({ mikroOrmRepository, ...restOptions }: MikroOrmEntityOptions<any>): Record<string, any> => (
    filterOptions({
        repository: mikroOrmRepository,
        ...restOptions,
    })
);

/**
 * Parse TypeORM entity options, renaming 'typeOrmRepository' to 'repository'.
 *
 * @param {TypeOrmEntityOptions} options - TypeORM entity options.
 * @returns {Record<string, any>} - Parsed options.
 */
export const parseTypeOrmEntityOptions = ({ typeOrmRepository, ...restOptions }: TypeOrmEntityOptions): Record<string, any> => (
    filterOptions({
        repository: typeOrmRepository,
        ...restOptions,
    })
);

/**
 * Filters out undefined values from an object and returns a new object with only defined values.
 *
 * @param options The source object to be filtered. This can be of any type.
 * @returns {Record<string, any>} - Parsed options without undefined values.
 */
export const filterOptions = <T>(options: T): Record<string, any> => Object.fromEntries(
    Object.entries(options).filter(([_, value]) => value !== undefined)
);
