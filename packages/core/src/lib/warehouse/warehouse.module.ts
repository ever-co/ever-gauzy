import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Product } from './../core/entities/internal';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { TypeOrmProductRepository } from '../product/repository/type-orm-product.repository';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { TypeOrmWarehouseProductRepository } from './repository/type-orm-warehouse-product.repository ';
import { TypeOrmWarehouseProductVariantRepository } from './repository/type-orm-warehouse-product-variant.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Warehouse, Product, WarehouseProduct, WarehouseProductVariant]),
		MikroOrmModule.forFeature([Warehouse, Product, WarehouseProduct, WarehouseProductVariant]),
		RolePermissionModule
	],
	controllers: [WarehouseController],
	providers: [
		WarehouseService,
		WarehouseProductService,
		TypeOrmProductRepository,
		TypeOrmWarehouseRepository,
		TypeOrmWarehouseProductRepository,
		TypeOrmWarehouseProductVariantRepository
	]
})
export class WarehouseModule {}
