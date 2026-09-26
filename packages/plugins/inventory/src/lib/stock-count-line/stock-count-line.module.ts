/**
 * NestJS module of the StockCountLine aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { StockCountLine } from './stock-count-line.entity';
import { StockCountLineController } from './stock-count-line.controller';
import { StockCountLineService } from './stock-count-line.service';
import { TypeOrmStockCountLineRepository } from './repository/type-orm-stock-count-line.repository';
import { MikroOrmStockCountLineRepository } from './repository/mikro-orm-stock-count-line.repository';
import { StockCountLineResolver } from '../graphql/stock-count-line.resolver';

@Module({
	controllers: [StockCountLineController],
	imports: [TypeOrmModule.forFeature([StockCountLine]), MikroOrmModule.forFeature([StockCountLine]), RolePermissionModule],
	providers: [StockCountLineService, TypeOrmStockCountLineRepository, MikroOrmStockCountLineRepository, StockCountLineResolver],
	exports: [StockCountLineService]
})
export class StockCountLineModule {}
