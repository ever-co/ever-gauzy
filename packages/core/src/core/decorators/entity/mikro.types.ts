import { EntityOptions as MikroEntityOptions, Constructor } from "@mikro-orm/core";

/**
 * Options for defining MikroORM entities.
 *
 * @template T - Type of the entity.
 */
export type MikroOrmEntityOptions<T> = MikroEntityOptions<T> & {
    /**
     * Optional function returning the repository constructor.
     */
    microOrmRepository?: () => Constructor;
};
