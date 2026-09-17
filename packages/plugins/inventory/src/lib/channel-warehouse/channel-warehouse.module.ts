/**
 * NestJS module of the ChannelWarehouse aggregate.
 *
 * It owns the aggregate end to end: the entity, its repositories, its service and its controller.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { ChannelWarehouse } from './channel-warehouse.entity';
import { ChannelWarehouseController } from './channel-warehouse.controller';
import { ChannelWarehouseService } from './channel-warehouse.service';
import { TypeOrmChannelWarehouseRepository } from './repository/type-orm-channel-warehouse.repository';
import { MikroOrmChannelWarehouseRepository } from './repository/mikro-orm-channel-warehouse.repository';

@Module({
	controllers: [ChannelWarehouseController],
	imports: [TypeOrmModule.forFeature([ChannelWarehouse]), MikroOrmModule.forFeature([ChannelWarehouse]), RolePermissionModule],
	providers: [ChannelWarehouseService, TypeOrmChannelWarehouseRepository, MikroOrmChannelWarehouseRepository],
	exports: [ChannelWarehouseService]
})
export class ChannelWarehouseModule {}
