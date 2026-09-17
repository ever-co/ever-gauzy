/**
 * The migrations this plugin owns.
 *
 * They are declared in the plugin metadata and merged into the connection's migration list before the
 * connection is created, so ordering follows each migration's own timestamp rather than the order
 * plugins happen to be listed in. The second migration adds a constraint to a kernel table, which is
 * why it is a file of its own: a set's files stay contiguous, and the timestamp is what guarantees it
 * runs after the table it references exists.
 */
export { CreatePricingTables1791000000120 } from './1791000000120-CreatePricingTables';
export { AddPriceListForeignKeys1791000000130 } from './1791000000130-AddPriceListForeignKeys';
export { AddPriceComputationColumns1791000000135 } from './1791000000135-AddPriceComputationColumns';

