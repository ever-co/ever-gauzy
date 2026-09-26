/**
 * NestJS module of the StockMovement aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { StockMovement } from './stock-movement.entity';
import { StockMovementController } from './stock-movement.controller';
import { StockMovementService } from './stock-movement.service';
import { TypeOrmStockMovementRepository } from './repository/type-orm-stock-movement.repository';
import { MikroOrmStockMovementRepository } from './repository/mikro-orm-stock-movement.repository';
import { StockMovementResolver } from '../graphql/stock-movement.resolver';

@Module({
	controllers: [StockMovementController],
	imports: [TypeOrmModule.forFeature([StockMovement]), MikroOrmModule.forFeature([StockMovement]), RolePermissionModule],
	providers: [StockMovementService, TypeOrmStockMovementRepository, MikroOrmStockMovementRepository, StockMovementResolver],
	exports: [StockMovementService]
})
export class StockMovementModule {}
