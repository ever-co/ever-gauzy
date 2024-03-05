import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { Product } from './../core/entities/internal';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { RolePermissionModule } from '../role-permission/role-permission.module';

const forFeatureEntities = [
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
		TypeOrmModule.forFeature(forFeatureEntities),
		MikroOrmModule.forFeature(forFeatureEntities),
		RolePermissionModule,
	],
	controllers: [WarehouseController],
	providers: [WarehouseService, WarehouseProductService, TypeOrmWarehouseRepository],
	exports: [WarehouseService, WarehouseProductService, TypeOrmWarehouseRepository]
})
export class WarehouseModule { }
