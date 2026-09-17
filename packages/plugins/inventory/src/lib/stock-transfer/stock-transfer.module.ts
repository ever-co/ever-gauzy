/**
 * NestJS module of the StockTransfer aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { InventorySequenceModule } from './../inventory-sequence.module';
import { StockLevelModule } from './../stock-level/stock-level.module';
import { StockTransfer } from './stock-transfer.entity';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';
import { TypeOrmStockTransferRepository } from './repository/type-orm-stock-transfer.repository';
import { MikroOrmStockTransferRepository } from './repository/mikro-orm-stock-transfer.repository';

@Module({
	controllers: [StockTransferController],
	imports: [TypeOrmModule.forFeature([StockTransfer]), MikroOrmModule.forFeature([StockTransfer]), RolePermissionModule, StockLevelModule, InventorySequenceModule],
	providers: [StockTransferService, TypeOrmStockTransferRepository, MikroOrmStockTransferRepository],
	exports: [StockTransferService]
})
export class StockTransferModule {}
