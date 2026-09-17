/**
 * NestJS module of the StockAdjustment aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { InventorySequenceModule } from './../inventory-sequence.module';
import { StockLevelModule } from './../stock-level/stock-level.module';
import { StockAdjustment } from './stock-adjustment.entity';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import { TypeOrmStockAdjustmentRepository } from './repository/type-orm-stock-adjustment.repository';
import { MikroOrmStockAdjustmentRepository } from './repository/mikro-orm-stock-adjustment.repository';

@Module({
	controllers: [StockAdjustmentController],
	imports: [TypeOrmModule.forFeature([StockAdjustment]), MikroOrmModule.forFeature([StockAdjustment]), RolePermissionModule, StockLevelModule, InventorySequenceModule],
	providers: [StockAdjustmentService, TypeOrmStockAdjustmentRepository, MikroOrmStockAdjustmentRepository],
	exports: [StockAdjustmentService]
})
export class StockAdjustmentModule {}
