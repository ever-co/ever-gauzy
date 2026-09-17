/**
 * NestJS module of the StockReservation aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { StockLevelModule } from './../stock-level/stock-level.module';
import { StockReservation } from './stock-reservation.entity';
import { StockReservationController } from './stock-reservation.controller';
import { StockReservationService } from './stock-reservation.service';
import { TypeOrmStockReservationRepository } from './repository/type-orm-stock-reservation.repository';
import { MikroOrmStockReservationRepository } from './repository/mikro-orm-stock-reservation.repository';

@Module({
	controllers: [StockReservationController],
	imports: [TypeOrmModule.forFeature([StockReservation]), MikroOrmModule.forFeature([StockReservation]), RolePermissionModule, StockLevelModule],
	providers: [StockReservationService, TypeOrmStockReservationRepository, MikroOrmStockReservationRepository],
	exports: [StockReservationService]
})
export class StockReservationModule {}
