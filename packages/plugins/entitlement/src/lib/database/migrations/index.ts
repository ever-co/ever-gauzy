export * from './1791000000360-CreateEntitlementTables';

import { CreateEntitlementTables1791000000360 } from './1791000000360-CreateEntitlementTables';

/**
 * Every migration this plugin owns, in run order.
 *
 * The platform merges these classes into the connection's migration list before the connection is
 * created, so a package that is installed is a package whose schema is installed, and the order is
 * decided by the timestamps rather than by the order plugins happen to be listed in.
 */
export const ENTITLEMENT_MIGRATIONS = [CreateEntitlementTables1791000000360];
