/**
 * NestJS module of the inventory plugin.
 *
 * It mounts every aggregate of the domain plus the two shared providers they depend on: the ledger
 * engine, which is the only write path into stock, and the numbering allocator. Nothing here reaches
 * into another plugin’s module graph.
 *
 * It also provides the package’s two capability seams — what may be sold of a variant, and the ledger
 * as another package reads and writes it. Both are exported, because a seam a module does not export
 * is a capability no installation can bind: the composition point that joins a consumer’s port to its
 * provider can only name a service the package makes reachable. Neither seam owns a table of its own;
 * they read the ledger’s rows and the level rows, and they are registered here so that one instance of
 * each answers the whole installation.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseProductVariant } from '@gauzy/core';
import { StockMovement } from './stock-movement/stock-movement.entity';
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
import { StockAvailabilityService } from './stock-availability/stock-availability.service';
import { StockLedgerService } from './stock-ledger/stock-ledger.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([StockMovement, WarehouseProductVariant]),
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
	providers: [StockAvailabilityService, StockLedgerService],
	exports: [
		StockAvailabilityService,
		StockLedgerService,
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
