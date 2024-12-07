import { FindManyOptions, FindOptionsWhere } from "typeorm";

/**
 * Parses TypeORM `FindManyOptions` to include `loadEagerRelations: false` and converts the 'where' option.
 *
 * @param options The options to parse.
 * @returns The parsed options with default values.
 */
export function parseTypeORMFindCountOptions<T>(options: FindManyOptions): FindManyOptions<T> {
    // Default options with loadEagerRelations set to false
    const typeormOptions: FindManyOptions<T> = {
        loadEagerRelations: false
    };

    // Use the provided options for 'where' (if available)
    let where: FindOptionsWhere<T> = {};

    // Parses TypeORM `where` option to MikroORM `where` option
    if (options && options.where) {
        where = options.where as FindOptionsWhere<T>;
    }

    // Merge the options and return
    return { ...typeormOptions, where };
}
