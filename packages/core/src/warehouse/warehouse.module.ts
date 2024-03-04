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
		TenantModule,
		UserModule
	],
	controllers: [WarehouseController],
	providers: [WarehouseService, WarehouseProductService],
	exports: [WarehouseService, WarehouseProductService]
})
export class WarehouseModule { }
