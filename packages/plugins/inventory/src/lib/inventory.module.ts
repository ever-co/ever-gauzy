/**
 * NestJS module of the inventory plugin.
 *
 * It mounts every aggregate of the domain plus the two shared providers they depend on: the ledger
 * engine, which is the only write path into stock, and the numbering allocator. Nothing here reaches
 * into another plugin’s module graph.
 */
import { Module } from '@nestjs/common';
import { StockLevelModule } from './stock-level/stock-level.module';
import { InventorySequenceModule } from './inventory-sequence.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { StockReservationModule } from './stock-reservation/stock-reservation.module';
import { StockTransferModule } from './stock-transfer/stock-transfer.module';
import { StockTransferLineModule } from './stock-transfer-line/stock-transfer-line.module';
import { StockAlertModule } from './stock-alert/stock-alert.module';
import { ChannelWarehouseModule } from './channel-warehouse/channel-warehouse.module';
import { StockAdjustmentModule } from './stock-adjustment/stock-adjustment.module';
import { StockCountModule } from './stock-count/stock-count.module';
import { StockCountLineModule } from './stock-count-line/stock-count-line.module';

@Module({
	imports: [
		StockLevelModule,
		InventorySequenceModule,
		StockMovementModule,
		StockReservationModule,
		StockTransferModule,
		StockTransferLineModule,
		StockAlertModule,
		ChannelWarehouseModule,
		StockAdjustmentModule,
		StockCountModule,
		StockCountLineModule
	],
	exports: [
		StockLevelModule,
		InventorySequenceModule,
		StockMovementModule,
		StockReservationModule,
		StockTransferModule,
		StockTransferLineModule,
		StockAlertModule,
		ChannelWarehouseModule,
		StockAdjustmentModule,
		StockCountModule,
		StockCountLineModule
	]
})
export class InventoryModule {}
