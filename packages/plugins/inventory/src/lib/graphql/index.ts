import { StockMovementResolver } from './stock-movement.resolver';
import { StockReservationResolver } from './stock-reservation.resolver';
import { StockTransferResolver } from './stock-transfer.resolver';
import { StockTransferLineResolver } from './stock-transfer-line.resolver';
import { StockAlertResolver } from './stock-alert.resolver';
import { StockAdjustmentResolver } from './stock-adjustment.resolver';
import { StockCountResolver } from './stock-count.resolver';
import { StockCountLineResolver } from './stock-count-line.resolver';
import { ChannelWarehouseResolver } from './channel-warehouse.resolver';
import { StockLevelResolver } from './stock-level.resolver';

export * from './inventory.schema';
export * from './stock-movement.resolver';
export * from './stock-reservation.resolver';
export * from './stock-transfer.resolver';
export * from './stock-transfer-line.resolver';
export * from './stock-alert.resolver';
export * from './stock-adjustment.resolver';
export * from './stock-count.resolver';
export * from './stock-count-line.resolver';
export * from './channel-warehouse.resolver';
export * from './stock-level.resolver';

/**
 * The domain's resolvers, in the order the schema extension expects them.
 *
 * The array exists so that the two places needing it read the same list: the module provides them,
 * which is what registers them with Nest, and the plugin metadata declares them, which is what composes
 * their SDL with the rest of the schema.
 */
export const inventoryResolvers = [
	StockLevelResolver,
	StockMovementResolver,
	StockReservationResolver,
	StockTransferResolver,
	StockTransferLineResolver,
	StockAlertResolver,
	StockAdjustmentResolver,
	StockCountResolver,
	StockCountLineResolver,
	ChannelWarehouseResolver
];
