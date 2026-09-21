/**
 * NestJS module of the StockAlert aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { StockAlert } from './stock-alert.entity';
import { StockAlertController } from './stock-alert.controller';
import { StockAlertService } from './stock-alert.service';
import { TypeOrmStockAlertRepository } from './repository/type-orm-stock-alert.repository';
import { MikroOrmStockAlertRepository } from './repository/mikro-orm-stock-alert.repository';
import { StockAlertResolver } from '../graphql/stock-alert.resolver';

@Module({
	controllers: [StockAlertController],
	imports: [TypeOrmModule.forFeature([StockAlert]), MikroOrmModule.forFeature([StockAlert]), RolePermissionModule],
	providers: [StockAlertService, TypeOrmStockAlertRepository, MikroOrmStockAlertRepository, StockAlertResolver],
	exports: [StockAlertService]
})
export class StockAlertModule {}
