import { getORMType, MultiORMEnum } from '../core/utils';

/**
 * MikroORM is initialised under every DB_ORM, because its repositories are injected everywhere. Under TypeORM
 * (production) it serves no request, yet it used to
 *
 * - connect at boot (`connect`, then `ensureDatabase`'s `select 1 from pg_database ...`) through its own pool - a
 *   connection that could not be acquired within DB_CONNECTION_TIMEOUT while the boot was busy discovering entities
 *   failed the whole API ("KnexTimeoutError: Knex: Timeout acquiring a connection"), although TypeORM itself retries
 *   for minutes; and
 * - register its request-context middleware on every `/api` route, forking an EntityManager (identity map, unit of
 *   work, change-set computer...) for every request that never touched it.
 *
 * Under TypeORM it now connects lazily, on the first query anything actually sends through it, and registers no
 * middleware; `allowGlobalContext` keeps such a query working on the global EntityManager instead of refusing it for
 * the lack of a fork. Under DB_ORM=mikro-orm nothing changes.
 */
export function mikroOrmOptionsForActiveOrm<T extends object>(options: T): T {
	if (getORMType() === MultiORMEnum.MikroORM || !options) {
		return options;
	}
	return {
		...options,
		connect: false,
		ensureDatabase: false,
		registerRequestContext: false,
		allowGlobalContext: true
	};
}
