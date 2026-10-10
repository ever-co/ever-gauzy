/**
 * NestJS module of the StockCount aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { InventorySequenceModule } from './../inventory-sequence.module';
import { StockLevelModule } from './../stock-level/stock-level.module';
import { StockCount } from './stock-count.entity';
import { StockCountController } from './stock-count.controller';
import { StockCountService } from './stock-count.service';
import { TypeOrmStockCountRepository } from './repository/type-orm-stock-count.repository';
import { MikroOrmStockCountRepository } from './repository/mikro-orm-stock-count.repository';
import { StockCountResolver } from '../graphql/stock-count.resolver';

@Module({
	controllers: [StockCountController],
	imports: [TypeOrmModule.forFeature([StockCount]), MikroOrmModule.forFeature([StockCount]), RolePermissionModule, StockLevelModule, InventorySequenceModule],
	providers: [StockCountService, TypeOrmStockCountRepository, MikroOrmStockCountRepository, StockCountResolver],
	exports: [StockCountService]
})
export class StockCountModule {}
