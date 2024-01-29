import { MikroOrmEntityOptions, TypeOrmEntityOptions } from "./entity-options.types";

/**
 * Parse MikroORM entity options, renaming 'microOrmRepository' to 'repository'.
 *
 * @param {MikroOrmEntityOptions<any>} options - MikroORM entity options.
 * @returns {Record<string, any>} - Parsed options.
 */
export const parseMikroOrmEntityOptions = ({ microOrmRepository, ...restOptions }: MikroOrmEntityOptions<any>): Record<string, any> => (
    filterOptions({
        repository: microOrmRepository,
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
 * Parse options and filter out properties with undefined values.
 *
 * @param {MikroOrmEntityOptions<any>} options - Options to parse.
 * @returns {Record<string, any>} - Parsed options without undefined values.
 */
export const filterOptions = (options: MikroOrmEntityOptions<any>): Record<string, any> => Object.fromEntries(
    Object.entries(options).filter(([_, value]) => value !== undefined)
);
