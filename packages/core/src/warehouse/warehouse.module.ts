import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WarehouseService } from './warehouse.service';
import { TenantModule } from '../tenant/tenant.module';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { UserModule } from './../user/user.module';
import { Product } from './../core/entities/internal';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';

const entities = [
	Warehouse,
	Product,
	WarehouseProduct,
	WarehouseProductVariant
];

@Module({
	imports: [
		RouterModule.register([
			{ path: '/warehouses', module: WarehouseModule }
		]),
		TypeOrmModule.forFeature(entities),
		MikroOrmModule.forFeature(entities),
		TenantModule,
		UserModule
	],
	controllers: [WarehouseController],
	providers: [WarehouseService, WarehouseProductService, TypeOrmWarehouseRepository],
	exports: [WarehouseService, WarehouseProductService, TypeOrmWarehouseRepository]
})
export class WarehouseModule { }
