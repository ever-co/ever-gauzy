import { FindManyOptions, FindOptionsWhere } from "typeorm";
import { parseToBoolean } from '@gauzy/utils';

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

    // A count states `withDeleted` exactly as a read does, and TypeORM honours it only when it is passed
    // on. It was dropped here, so `count({ withDeleted: true })` answered the live rows on TypeORM and every
    // row on MikroORM, whose converter already forwarded it — a list's `totalCount` then depended on the ORM
    // it ran on. Read as the boolean it states, like every other read entry point.
    const withDeleted = options && parseToBoolean((options as { withDeleted?: unknown }).withDeleted);

    // Merge the options and return
    return { ...typeormOptions, where, ...(withDeleted ? { withDeleted: true } : {}) };
}
