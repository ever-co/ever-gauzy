/**
 * NestJS module of the StockTransferLine aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { StockTransferLine } from './stock-transfer-line.entity';
import { StockTransferLineController } from './stock-transfer-line.controller';
import { StockTransferLineService } from './stock-transfer-line.service';
import { TypeOrmStockTransferLineRepository } from './repository/type-orm-stock-transfer-line.repository';
import { MikroOrmStockTransferLineRepository } from './repository/mikro-orm-stock-transfer-line.repository';

@Module({
	controllers: [StockTransferLineController],
	imports: [TypeOrmModule.forFeature([StockTransferLine]), MikroOrmModule.forFeature([StockTransferLine]), RolePermissionModule],
	providers: [StockTransferLineService, TypeOrmStockTransferLineRepository, MikroOrmStockTransferLineRepository],
	exports: [StockTransferLineService]
})
export class StockTransferLineModule {}
